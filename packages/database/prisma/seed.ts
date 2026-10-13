/**
 * Deterministic demo dataset for the Kora platform.
 *
 * Design notes:
 *  - Idempotent: re-running upserts rather than duplicating.
 *  - 365 days of sales per SME, with weekday seasonality, a growth trend and
 *    a promo spike, so forecasting/credit scoring have real signal to learn
 *    from instead of a flat line.
 *  - Every money movement is posted through the ledger as balanced legs and
 *    flagged simulated=true, because disbursement is gated.
 *  - Accounts share Demo@1234, matching the existing SalesPilot seed
 *    convention.
 */
// Load .env when present (local dev), but do not fail if it is missing:
// DATABASE_URL may already be exported by the shell or the deployment env.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv/config");
} catch {
  // no local .env; rely on the ambient environment
}
import { PrismaClient } from "../generated/client";
import { BRAND } from "@kora/brand";
import {
  bnplLegs,
  post,
  saleLegs,
  savingsDepositLegs,
  savingsWithdrawalLegs,
  subscriptionLegs,
} from "@kora/ledger";
// ── Why these imports are relative paths, not `@kora/auth` ────────────────
// `@kora/auth` depends on `@kora/database`, so declaring it as a dependency
// here would close a cycle that `turbo.json` (`build.dependsOn: ["^build"]`)
// refuses to schedule — the seed could never run. Only the two
// zero-dependency modules are reached into, and both are still type-checked by
// this package's own `tsc --noEmit`. This is a monorepo-internal seed script,
// not a published entry point, so the coupling is contained and deliberate.
import { hashPassword } from "../../auth/src/password";
import { setUserPlan } from "../../auth/src/entitlement-sync";
import { TIERS, type Tier } from "../../auth/src/entitlements";
import { chance, float, int, makeRng, pick, round2, type Rng } from "./rng";
import {
  BUSINESS_TYPES,
  CATALOG,
  FIRST_NAMES,
  LAST_NAMES,
  TOWNS,
} from "./reference-data";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";
const DAYS_OF_HISTORY = 365;
const PLATFORM_FEE = 5; // KES per SME sale
const SUBSCRIPTION_AMOUNT = 2500; // KES monthly

const rng = makeRng(20260101);

/**
 * Phone book: the number currently held by each account, keyed by email.
 *
 * ── Why phone numbers cannot come from the RNG ──────────────────────────────
 * `users.phone` is `@unique`, but `upsertUser` upserts on **email** alone and
 * `resetGenerated` never deletes a user, so those rows survive every re-seed.
 * Drawing the number from `rng` meant any edit that consumed a single random
 * value shifted the whole stream and re-assigned every phone at once — one
 * account could then be updated onto a number a *different*, not-yet-rewritten
 * account still held. That is exactly the P2002 that stopped a run part-way
 * through `seedCustomers`.
 *
 * Deriving the number from the email makes it a pure function of the account:
 * a re-seed writes the identical value back, the update is a no-op, and no two
 * accounts can ever be handed the same number. The book is primed from the
 * database first so even the first run after this change cannot land on a row
 * belonging to someone else.
 */
const phoneBook = new Map<string, string>(); // phone -> email

/** Read what the database already holds so a fresh number can never collide. */
async function primePhoneBook() {
  const [users, customers] = await Promise.all([
    prisma.user.findMany({ select: { email: true, phone: true } }),
    prisma.customer.findMany({ select: { email: true, phone: true } }),
  ]);
  // Users first: they are the rows `upsertUser` writes, so on a clash between
  // the two tables the user record wins the number it is already holding.
  for (const row of [...users, ...customers]) {
    if (row.email && row.phone && !phoneBook.has(row.phone)) {
      phoneBook.set(row.phone, row.email);
    }
  }
}

/** Stable hash of an email into an unsigned 32-bit space. */
function hashEmail(email: string): number {
  let h = 0;
  for (const ch of email) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h;
}

function phoneFor(email: string): string {
  const base = hashEmail(email);
  // `0x9e3779b9` spreads consecutive attempts across the number space instead
  // of walking linearly, so a clash resolves in one or two steps rather than
  // after hundreds. Deterministic: every run picks the same winner.
  for (let salt = 0; salt < 4096; salt++) {
    const h = (base + Math.imul(salt, 0x9e3779b9)) >>> 0;
    const phone = `+2547${10 + (h % 70)}${String(100000 + ((h >>> 7) % 900000))}`;
    const owner = phoneBook.get(phone);
    if (owner === email) return phone;
    if (owner === undefined) {
      phoneBook.set(phone, email);
      return phone;
    }
  }
  throw new Error(`Could not derive a unique phone number for ${email}`);
}
function personName(r: Rng): string {
  return `${pick(r, FIRST_NAMES)} ${pick(r, LAST_NAMES)}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function skuFor(si: number, pi: number): string {
  return `KORA-${String(si + 1).padStart(2, "0")}-${String(pi + 1).padStart(3, "0")}`;
}
function barcodeFor(sku: string): string {
  let hash = 0;
  for (const ch of sku) hash = (hash * 31 + ch.charCodeAt(0)) % 1000000000000;
  return String(1000000000000 + hash);
}

async function upsertUser(input: {
  email: string;
  fullName: string;
  phone: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
}) {
  // A fresh hash per account, from a fresh random salt. Hashing once and
  // reusing the string would give all 71 demo logins the same salt — the exact
  // shared-secret failure a per-password salt exists to prevent — and would
  // make the seed a poor example of the pattern it exists to demonstrate.
  // `update` sets it too, so re-seeding restores a known-good password.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      passwordHash,
    },
    create: {
      authUserId: `seed-${input.email}`,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      passwordHash,
    },
  });
}

/**
 * Put a seeded account on a plan.
 *
 * Routed through `setUserPlan` rather than writing `user_plans` and
 * `user_role_assignments` directly, because the tier is also what grants the
 * secondary roles — STANDARD adds SUPPLIER, METAL adds SUPPLIER and CUSTOMER.
 * Writing the rows by hand here would duplicate that policy in a second place
 * and let the demo data drift from what the server actually enforces.
 */
async function assignPlan(userId: string, tier: Tier, reason: string) {
  await setUserPlan(prisma, {
    userId,
    tier,
    status: "ACTIVE",
    cycle: "MONTHLY",
    amount: TIERS[tier].price,
    reason,
  });
}

type Seeded = {
  sme: { id: string; businessName: string; userId: string };
  products: Array<{ id: string; price: number; cost: number; name: string }>;
  base: number;
  growth: number;
};

/**
 * Daily transaction count for a given SME.
 *
 * Shape is deliberate so downstream AI has real signal:
 *  - base volume with weekday seasonality (weekends busier for retail)
 *  - a growth trend across the year
 *  - a promo spike in the most recent month
 *  - small random noise
 */
function dailyVolume(base: number, growth: number, daysBack: number, r: Rng): number {
  if (base <= 1) return chance(r, 0.25) ? 1 : 0;

  const dow = daysAgo(daysBack).getDay();
  const weekdayFactor = dow === 0 ? 1.15 : dow === 6 ? 1.45 : dow === 1 ? 0.85 : 1.0;
  const trend = 1 - growth * (daysBack / DAYS_OF_HISTORY);
  const promo = daysBack < 30 ? 1.35 : 1.0;
  const noise = float(r, 0.7, 1.35);
  return Math.max(0, Math.round(base * weekdayFactor * trend * promo * noise));
}


type PendingPosting = {
  reference: string;
  type: string;
  description: string;
  accountCode: string;
  amount: number;
  smeId: string;
  customerId: string | null;
  postedAt: Date;
  legs: Array<{
    accountCode: string;
    direction: "DEBIT" | "CREDIT";
    amount: number;
    narration: string;
  }>;
};

/**
 * Write a batch of postings: one Transaction header each, then the legs.
 * Uses createManyAndReturn so ledger entries can be attached in bulk.
 * Rebalances the (in-memory) 0.001 float slack per posting into a single
 * rounding leg so debits still equal credits to the cent.
 */
async function postBatch(postings: PendingPosting[]) {
  if (postings.length === 0) return 0;

  const headers = postings.map((p) => {
    const totalLegs = p.legs.reduce((s, l) => s + l.amount, 0) / 2;
    return {
      reference: p.reference,
      type: p.type,
      description: p.description,
      accountCode: p.accountCode,
      amount: round2(totalLegs),
      currency: "KES",
      smeId: p.smeId,
      customerId: p.customerId,
      simulated: true,
      postedAt: p.postedAt,
    };
  });

      const existingRefs = new Set(
          (await prisma.transaction.findMany({
            where: { reference: { in: headers.map(h => h.reference) } },
            select: { reference: true },
          })).map(t => t.reference)
        );
        const newHeaders = headers.filter(h => !existingRefs.has(h.reference));

        if (newHeaders.length === 0) return postings.length;

            const created = await prisma.transaction.createManyAndReturn({
              data: newHeaders,
              select: { id: true, reference: true },
            });

      const byRef = new Map<string, string>(created.map((t) => [t.reference, t.id]));
      const entries: Array<{
        transactionId: string;
        accountCode: string;
        direction: "DEBIT" | "CREDIT";
        amount: number;
        narration: string;
      }> = [];
      for (const p of postings) {
        const txnId = byRef.get(p.reference);
        if (!txnId) continue;
        for (const l of p.legs) {
          entries.push({
            transactionId: txnId,
            accountCode: l.accountCode,
            direction: l.direction,
            amount: round2(l.amount),
            narration: l.narration,
          });
        }
      }

  for (let i = 0; i < entries.length; i += 2000) {
    await prisma.ledgerEntry.createMany({ data: entries.slice(i, i + 2000) });
  }
  return postings.length;
}

/**
 * Build 365 days of sales. Rows are accumulated and written in batches so
 * seeding tens of thousands of sales stays fast.
 */
async function seedSalesHistory(smes: Seeded[], customers: Array<{ id: string }>) {
  let saleTotal = 0;
  let postingTotal = 0;

  for (let smeIndex = 0; smeIndex < smes.length; smeIndex++) {
    const s = smes[smeIndex];
    const own = customers.filter((_, i) => i % smes.length === smeIndex % smes.length);
    const pool = own.length > 0 ? own : customers;

    let saleRows: Array<Record<string, unknown>> = [];
    let itemRows: Array<Record<string, unknown>> = [];
    let postings: PendingPosting[] = [];
    // Index within the CURRENT batch; sales are re-keyed on every flush, so
    // this resets per batch while smeTotal accumulates across batches.
    let lineNo = 0;
    let smeTotal = 0;

    const flush = async () => {
      if (saleRows.length === 0) return;
      const sales = await prisma.sale.createManyAndReturn({
        data: saleRows as never,
        select: { id: true },
      });
      // Attach items to the sales just created, in insertion order.
      const clean = itemRows.map((row) => {
        const idx = row.__saleIndex as number;
        const saleId = sales[idx]?.id;
        return {
          saleId,
          productId: row.productId as string,
          quantity: row.quantity as number,
          unitPrice: row.unitPrice as number,
          lineTotal: row.lineTotal as number,
          costPrice: row.costPrice as number,
        };
      });
      for (let i = 0; i < clean.length; i += 2000) {
        await prisma.saleItem.createMany({ data: clean.slice(i, i + 2000) });
      }
      postingTotal += await postBatch(postings);
      smeTotal += saleRows.length;
      saleRows = [];
      itemRows = [];
      postings = [];
      lineNo = 0;
    };

    for (let daysBack = DAYS_OF_HISTORY - 1; daysBack >= 0; daysBack--) {
      const count = dailyVolume(s.base, s.growth, daysBack, rng);
      for (let n = 0; n < count; n++) {
        const soldAt = daysAgo(daysBack);
        soldAt.setHours(int(rng, 8, 19), int(rng, 0, 59), 0, 0);
        const customerId = chance(rng, 0.7) ? pick(rng, pool).id : null;

        const lineCount = Math.min(s.products.length, int(rng, 1, 3));
        const chosen = new Set<number>();
        while (chosen.size < lineCount) chosen.add(int(rng, 0, s.products.length - 1));

        let total = 0;
        let costTotal = 0;
        const myIndex = lineNo++;
        for (const idx of chosen) {
          const p = s.products[idx];
          const qty = int(rng, 1, 4);
          const lineTotal = round2(p.price * qty);
          total = round2(total + lineTotal);
          costTotal = round2(costTotal + round2(p.cost * qty));
          itemRows.push({
            __saleIndex: myIndex,
            productId: p.id,
            quantity: qty,
            unitPrice: p.price,
            lineTotal,
            costPrice: p.cost,
          });
        }

        const method = pick(rng, ["MPESA_STK", "MPESA_STK", "MPESA_STK", "CASH", "WALLET"] as const);
        const fee = total >= PLATFORM_FEE ? PLATFORM_FEE : 0;
        const ref = `SALE-${s.sme.id.slice(-6)}-${daysBack}-${n}`;

        saleRows.push({
          smeId: s.sme.id,
          customerId,
          totalAmount: total,
          costTotal,
          paymentMethod: method,
          paymentStatus: "COMPLETED",
          platformFee: fee,
          mpesaReceipt: method === "CASH" ? null : `QJG${int(rng, 100000, 999999)}`,
          simulated: true,
          soldAt,
        });

        postings.push({
          reference: ref,
          type: "SALE",
          description: "Customer payment at till",
          accountCode: "SME_WALLET",
          amount: total,
          smeId: s.sme.id,
          customerId,
          postedAt: soldAt,
          legs: saleLegs(total, fee).map((l) => ({
            accountCode: l.accountCode as string,
            direction: l.direction as "DEBIT" | "CREDIT",
            amount: l.amount,
            narration: l.narration ?? "",
          })),
        });
      }

      if (saleRows.length >= 500) await flush();
    }
    await flush();
    saleTotal += smeTotal;
    console.log(`  sales: ${s.sme.businessName} (${smeTotal} transactions)`);
  }

  console.log(`  sales total: ${saleTotal} | ledger postings: ${postingTotal}`);
  return saleTotal;
}



async function seedSuppliers() {
  const defs = [
    { name: "Nairobi Bulk Traders Ltd", rating: 4.6, county: "Nairobi", town: "Nairobi" },
    { name: "Rift Valley Distributors", rating: 4.2, county: "Nakuru", town: "Nakuru" },
    { name: "Coastal Supplies Co", rating: 3.8, county: "Mombasa", town: "Mombasa" },
    { name: "Highland Agro Depot", rating: 4.9, county: "Uasin Gishu", town: "Eldoret" },
  ];

  const out = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const email = `supplier${i + 1}@${BRAND.demoDomain}`;
    const user = await upsertUser({
      email,
      fullName: `${d.name} Accounts`,
      phone: phoneFor(email),
      role: "SUPPLIER",
    });
    // Suppliers are billed at STANDARD: they already hold the SUPPLIER role
    // as their primary, and the tier is what entitles them to SwiftPOS.
    await assignPlan(user.id, "STANDARD", "Seeded demo plan (STANDARD)");
    out.push(
      await prisma.supplier.upsert({
        where: { userId: user.id },
        update: { rating: d.rating, companyName: d.name },
        create: {
          userId: user.id,
          companyName: d.name,
          registrationNo: `PVT-${2024000 + i}`,
          contactEmail: user.email,
          contactPhone: user.phone,
          county: d.county,
          town: d.town,
          rating: d.rating,
          ratingCount: int(rng, 12, 90),
          mpesaPaybill: String(600000 + i),
        },
      }),
    );
  }
  console.log(`  suppliers: ${out.length}`);
  return out;
}

async function seedSmes(suppliers: Array<{ id: string }>): Promise<Seeded[]> {
  // The last entry is deliberately near-zero volume so the "insufficient
  // data" path in forecasting and scoring is exercised.
  //
  // `tier` spreads the six businesses across the three subscription tiers on
  // purpose, so a reviewer can sign in as one SME per tier and see the
  // entitlement ladder directly: sme1 holds all three products and can act as
  // both supplier and customer, sme2 holds two, sme3 holds one. Without seeded
  // plans every account would resolve to no tier at all and the app hub would
  // show nothing but locked tiles.
  const defs: Array<{
    biz: string;
    type: string;
    years: number;
    base: number;
    growth: number;
    tier: Tier;
  }> = [
    { biz: "Jubilee Retail Store", type: "Retail Shop", years: 8, base: 18, growth: 0.35, tier: "METAL" },
    { biz: "Nakuru Hardware Centre", type: "Hardware Store", years: 12, base: 11, growth: 0.2, tier: "STANDARD" },
    { biz: "Sprint Mobile Accessories", type: "Phone Accessories", years: 4, base: 22, growth: 0.6, tier: "FREE" },
    { biz: "Lakeview Supermarket", type: "Supermarket", years: 6, base: 30, growth: 0.15, tier: "METAL" },
    { biz: "Karen Fashion House", type: "Fashion Boutique", years: 2, base: 9, growth: 0.8, tier: "STANDARD" },
    { biz: "Duka Pharmacy", type: "Pharmacy", years: 1, base: 1, growth: 0.05, tier: "FREE" },
  ];

  const out: Seeded[] = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const loc = TOWNS[i % TOWNS.length];
    const email = `sme${i + 1}@${BRAND.demoDomain}`;
    const user = await upsertUser({
      email,
      fullName: personName(rng),
      phone: phoneFor(email),
      role: "SME",
    });

    // Granting the plan before the SME row is written is fine: the role sync
    // only touches `user_role_assignments`, and the SME profile is read back
    // independently by `requireScope`.
    await assignPlan(user.id, d.tier, `Seeded demo plan (${d.tier})`);

    // ── Why a paid SME also needs Supplier / Customer rows ───────────────────
    // The tier *grants* secondary roles (STANDARD adds SUPPLIER, METAL adds
    // SUPPLIER and CUSTOMER) but a grant only ever writes to
    // `user_role_assignments`. `requireScope` resolves `supplierId` /
    // `customerId` by reading the Supplier / Customer profile row behind the
    // role, so a granted role with no row hands back `undefined` and the route
    // answers 403 "No customer profile is linked to this account."
    //
    // That made the demo data contradict its own intent: sme1 is described as
    // able to act as both supplier and customer, yet opening /customer/shop,
    // adding to the cart and paying failed outright.
    //
    // The rows are derived from the assignments `setUserPlan` just wrote rather
    // than from `d.tier`, so the seed cannot drift from what billing actually
    // grants — if the tier policy changes, this follows it for free.
    const grantedRoles = new Set(
      (
        await prisma.userRoleAssignment.findMany({
          where: { userId: user.id, revokedAt: null },
          select: { role: true },
        })
      ).map((g) => g.role),
    );

    if (grantedRoles.has("SUPPLIER")) {
      await prisma.supplier.upsert({
        where: { userId: user.id },
        update: { companyName: d.biz },
        create: {
          userId: user.id,
          companyName: d.biz,
          registrationNo: `SUP-${2023000 + i}`,
          contactEmail: user.email,
          contactPhone: user.phone,
          county: loc.county,
          town: loc.town,
          // Sells its own stock, so it rates as an established vendor rather
          // than an unrated 0.00 newcomer.
          rating: round2(float(rng, 3.5, 4.9)),
          ratingCount: int(rng, 5, 40),
        },
      });
    }

    if (grantedRoles.has("CUSTOMER")) {
      // The SME buys through the storefront under its own identity. Credit is
      // left at zero deliberately: a business trading with itself should not
      // silently manufacture spend or a credit limit the ledger never saw.
      await prisma.customer.upsert({
        where: { userId: user.id },
        update: { fullName: d.biz },
        create: {
          userId: user.id,
          fullName: d.biz,
          phone: user.phone,
          email: user.email,
          county: loc.county,
          town: loc.town,
        },
      });
    }

    const sme = await prisma.sME.upsert({
      where: { userId: user.id },
      update: { businessName: d.biz, yearsInBusiness: d.years },
      create: {
        userId: user.id,
        businessName: d.biz,
        registrationNumber: `BN-${2023000 + i}`,
        businessType: d.type,
        county: loc.county,
        town: loc.town,
        address: `${loc.town} Commercial Area`,
        yearsInBusiness: d.years,
        onboardingStep: "COMPLETE",
        onboardingStatus: "APPROVED",
        mpesaTill: String(500000 + i),
        mpesaPaybill: String(400000 + i),
        subscriptionAmount: SUBSCRIPTION_AMOUNT,
        subscriptionStatus: "ACTIVE",
        subscriptionPaidAt: daysAgo(int(rng, 0, 20)),
      },
    });

    const products: Seeded["products"] = [];
    const catalog = CATALOG[d.type];
    for (let p = 0; p < catalog.length; p++) {
      const item = catalog[p];
      const sku = skuFor(i, p);
      const product = await prisma.product.upsert({
        where: { sku },
        update: { price: item.price },
        create: {
          smeId: sme.id,
          supplierId: suppliers[i % suppliers.length].id,
          name: item.name,
          description: `${item.name} supplied by ${d.biz}`,
          sku,
          barcode: barcodeFor(sku),
          category: item.category,
          price: item.price,
          costPrice: item.cost,
          stockQuantity: int(rng, 20, 260),
          reorderLevel: int(rng, 10, 30),
          lowStockThreshold: int(rng, 5, 20),
          isActive: true,
        },
      });
      products.push({
        id: product.id,
        price: Number(product.price),
        cost: Number(product.costPrice ?? item.cost),
        name: product.name,
      });
    }

    out.push({
      sme: { id: sme.id, businessName: d.biz, userId: user.id },
      products,
      base: d.base,
      growth: d.growth,
    });
    console.log(`  sme: ${d.biz} (${products.length} products)`);
  }
  return out;
}

async function seedCustomers() {
  const out = [];
  for (let i = 0; i < 60; i++) {
    const name = personName(rng);
    const loc = pick(rng, TOWNS);
    const email = `customer${i + 1}@${BRAND.demoDomain}`;
    const phone = phoneFor(email);
    const user = await upsertUser({
      email,
      fullName: name,
      phone,
      role: "CUSTOMER",
    });
    // Shoppers need the Neobank to buy on credit and settle from an account,
    // so they sit on METAL — the only tier that unlocks it.
    await assignPlan(user.id, "METAL", "Seeded demo plan (METAL)");
    const spend = round2(float(rng, 4000, 220000));
    const points = Math.floor(spend / 100);
    const tier =
      points > 1200 ? "PLATINUM" : points > 700 ? "GOLD" : points > 250 ? "SILVER" : "BRONZE";
    out.push(
      await prisma.customer.upsert({
        where: { userId: user.id },
        // `phone`/`email` are reconciled too, not just the name: without them a
        // re-seed could refresh the User row's number while the Customer row
        // kept the one from the run that first created it, leaving the same
        // person holding two different numbers in two tables.
        update: { fullName: name, phone, email },
        create: {
          userId: user.id,
          fullName: name,
          phone,
          email: user.email,
          county: loc.county,
          town: loc.town,
          loyaltyPoints: points,
          loyaltyTier: tier,
          totalSpend: spend,
          purchaseCount: int(rng, 3, 90),
          creditLimit: round2(spend * 0.3),
          creditScore: int(rng, 450, 850),
        },
      }),
    );
  }
  console.log(`  customers: ${out.length}`);
  return out;
}


type Factor = { name: string; weight: number; score: number; note: string };

/**
 * Placeholder credit scoring. Computes the same 10 factors the real engine
 * will, so the admin approval queue is fully exercisable. Milestone 2
 * replaces only this function, keeping the returned shape identical.
 */
function placeholderScore(input: {
  revenue90d: number;
  salesCount90d: number;
  retention: number;
  yearsInBusiness: number;
  activeLoan: boolean;
  savingsBalance: number;
  consistency: number;
  growth: number;
  riskBandOffset: number;
}): { score: number; risk: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"; factors: Factor[] } {
  const f: Factor[] = [];
  const add = (name: string, weight: number, score: number, note: string) =>
    f.push({ name, weight, score: Math.max(0, Math.min(100, Math.round(score))), note });

  add("salesConsistency", 12, input.consistency, "How evenly revenue is spread across trading days");
  add("revenueGrowth", 12, 50 + input.growth * 45, "Last 30 days vs the prior 30");
  add("transactionVolume", 10, Math.min(100, input.salesCount90d / 4), "Number of transactions in 90 days");
  add("customerRetention", 12, input.retention * 100, "Repeat buyer share");
  add("paymentHistory", 14, input.activeLoan ? 62 : 82, input.activeLoan ? "Existing obligations present" : "No missed payments recorded");
  add("businessAge", 8, Math.min(100, (input.yearsInBusiness / 10) * 100), `${input.yearsInBusiness} years trading`);
  add("inventoryTurnover", 8, 60, "Stock movement vs sales");
  add("debtToIncome", 14, input.activeLoan ? 48 : 85, input.activeLoan ? "Debt outstanding" : "No active debt");
  add("savingsBehaviour", 6, Math.min(100, (input.savingsBalance / 60000) * 100), "Savings balance relative to size");
  add("supplierRelations", 4, 70, "Supplier payment record");

  const totalWeight = f.reduce((s, x) => s + x.weight, 0);
  const weighted = f.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;

  // Spread scores around the middle of the band so a demo queue shows a
  // realistic mix of LOW / MEDIUM / HIGH rather than everything clustered
  // at the top. Real scoring (Milestone 2) does not need this.
  const adjusted = weighted * (1 + input.riskBandOffset);
  const score = Math.max(120, Math.min(940, Math.round(adjusted * 10)));
  const risk = score >= 750 ? "LOW" : score >= 580 ? "MEDIUM" : score >= 420 ? "HIGH" : "VERY_HIGH";
  return { score, risk, factors: f };
}

function interestFor(score: number): number {
  if (score >= 750) return 0.16;
  if (score >= 650) return 0.19;
  if (score >= 580) return 0.23;
  if (score >= 420) return 0.28;
  return 0.32;
}

function maxLoanFor(score: number, monthlyRevenue: number): number {
  // Cap the facility at 6x monthly revenue, scaled by score quality.
  const quality = score / 1000;
  return round2(Math.max(0, Math.min(300000, monthlyRevenue * 6 * (0.4 + quality))));
}

async function seedCredit(smes: Seeded[], adminUserId: string) {
  let loanCount = 0;
  for (let i = 0; i < smes.length; i++) {
    const s = smes[i];
    const since90 = daysAgo(90);
    const agg = await prisma.sale.aggregate({
      where: { smeId: s.sme.id, soldAt: { gte: since90 } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const revenue90d = Number(agg._sum.totalAmount ?? 0);
    const salesCount90d = agg._count._all;
    const monthlyRevenue = revenue90d / 3;

    const withCustomer = await prisma.sale.count({
      where: { smeId: s.sme.id, soldAt: { gte: since90 }, customerId: { not: null } },
    });
    const retention = salesCount90d > 0 ? withCustomer / salesCount90d : 0;

    const savings = await prisma.savings.findUnique({ where: { smeId: s.sme.id } });
    const activeLoan = (await prisma.loan.count({ where: { smeId: s.sme.id } })) > 0;
    const smeRow = await prisma.sME.findUniqueOrThrow({
      where: { id: s.sme.id },
      select: { yearsInBusiness: true },
    });

    // Sales consistency: how evenly revenue is spread across the 90 days.
    // A business trading steadily scores above one that spikes then goes quiet.
    const dailyRows = await prisma.$queryRaw<Array<{ d: string; amt: string }>>`
      select to_char(sold_at, 'YYYY-MM-DD') as d, sum(total_amount)::text as amt
      from kora.sales where sme_id = ${s.sme.id} and sold_at >= ${since90}
      group by 1 order by 1`;
    const amounts = dailyRows.map((r) => Number(r.amt));
    const mean = amounts.length
      ? amounts.reduce((a, b) => a + b, 0) / amounts.length
      : 0;
    const variance =
      amounts.length > 1
        ? amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length
        : 0;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 2;
    // CV 0 => perfectly even (100), CV 2+ => very erratic (0)
    const consistency = Math.max(0, Math.min(100, 100 - (cv / 2) * 100));

    // Revenue growth: last 30 days vs the 30 before it.
    const halves = await Promise.all([
      prisma.sale.aggregate({
        where: { smeId: s.sme.id, soldAt: { gte: daysAgo(30) } },
        _sum: { totalAmount: true },
      }),
      prisma.sale.aggregate({
        where: { smeId: s.sme.id, soldAt: { gte: daysAgo(60), lt: daysAgo(30) } },
        _sum: { totalAmount: true },
      }),
    ]);
    const recent = Number(halves[0]._sum.totalAmount ?? 0);
    const prior = Number(halves[1]._sum.totalAmount ?? 0);
    const growth = prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0;

    const { score, risk, factors } = placeholderScore({
      revenue90d,
      salesCount90d,
      retention,
      yearsInBusiness: smeRow.yearsInBusiness ?? 1,
      activeLoan,
      savingsBalance: Number(savings?.balance ?? 0),
      consistency,
      growth,
      // Nudge each SME onto a different part of the band so the admin
      // approval queue has a realistic spread to work with.
      riskBandOffset: ((i % 5) - 2) * 0.11,
    });

    const maxLoan = maxLoanFor(score, monthlyRevenue);
    const rate = interestFor(score);

    await prisma.creditScore.create({
      data: {
        smeId: s.sme.id,
        score,
        riskLevel: risk,
        maxLoan,
        interestRate: rate,
        explanation: `Score ${score}/1000 (${risk}). Monthly revenue approx KES ${Math.round(monthlyRevenue).toLocaleString()}, ${salesCount90d} sales in 90 days, ${Math.round(retention * 100)}% repeat buyers.`,
        recommendations:
          risk === "LOW"
            ? ["Eligible for the standard term", "Consider increasing stock cover for fast movers"]
            : risk === "MEDIUM"
              ? ["Improve repayment consistency to access a lower rate", "Build savings balance to improve terms"]
              : ["Reduce existing obligations before applying", "Grow transaction history over the next 90 days"],
        factors: factors as never,
        model: "deterministic-v1",
        isPlaceholder: true,
      },
    });

    if (i >= 5) continue;

    const principal = i === 0 ? 50000 : round2(maxLoan * float(rng, 0.4, 0.9));
    const term = pick(rng, [3, 6, 9, 12]);
    const totalPayable = round2(principal * (1 + rate * (term / 12)));
    const loanNumber = `LN-2026-${String(1000 + i)}`;

    const loan = await prisma.loan.upsert({
      where: { loanNumber },
      update: {},
      create: {
        loanNumber,
        smeId: s.sme.id,
        principal,
        interestRate: rate,
        termMonths: term,
        totalPayable,
        status: "PENDING_REVIEW",
        purpose: "Inventory restock",
        creditScoreAtApplication: score,
        maxApprovedAmount: principal,
      },
    });

    // SME 1 stays in the queue so the admin approval screen has work to do.
    if (i === 0) {
      loanCount++;
      continue;
    }

    const target = pick(rng, ["APPROVED", "BLOCKED_NO_PARTNER", "REPAYING", "SETTLED"] as const);
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: target,
        decisionReason: "Approved on automated review",
        decidedAt: daysAgo(int(rng, 10, 60)),
        decidedByUserId: adminUserId,
        firstPaymentDate: daysAgo(30),
        maturityDate: daysAgo(-term * 30),
        simulated: target !== "APPROVED",
        // APPROVED but not disbursed is exactly the gated state.
        blockedReason:
          target === "APPROVED"
            ? "Awaiting licensed disbursement partner. No funds have moved."
            : null,
      },
    });

    const per = round2(totalPayable / term);
    for (let k = 1; k <= term; k++) {
      const dueDate = daysAgo(term * 30 - k * 30);
      const paid = target === "SETTLED" ? true : dueDate < new Date() && chance(rng, 0.85);
      await prisma.repayment.upsert({
        where: { loanId_installmentNumber: { loanId: loan.id, installmentNumber: k } },
        update: {},
        create: {
          loanId: loan.id,
          installmentNumber: k,
          amountDue: per,
          amountPaid: paid ? per : 0,
          principalPaid: paid ? round2(principal / term) : 0,
          interestPaid: paid ? round2(per - principal / term) : 0,
          status: paid ? "PAID" : dueDate < new Date() ? "OVERDUE" : "PENDING",
          dueDate,
          paidAt: paid ? dueDate : null,
          mpesaReceipt: paid ? `QJG${int(rng, 100000, 999999)}` : null,
          simulated: true,
        },
      });
    }
    loanCount++;
  }
  console.log(`  credit scores + loans: ${loanCount}`);
}

async function seedSavings(smes: Seeded[]) {
  for (let i = 0; i < smes.length; i++) {
    const s = smes[i];
    if (s.base <= 1) continue; // low-volume SME keeps no savings account

    const accountNumber = `KSV-${String(7000 + i)}`;
    const savings = await prisma.savings.upsert({
      where: { smeId: s.sme.id },
      update: {},
      create: { smeId: s.sme.id, accountNumber, balance: 0, interestRate: 0.05 },
    });

    let balance = 0;
    let deposits = 0;
    let withdrawals = 0;
    let interest = 0;

    for (let m = 11; m >= 0; m--) {
      const dep = round2(float(rng, 4000, 30000));
      const wd = chance(rng, 0.35) ? round2(float(rng, 1000, 8000)) : 0;
      const int = round2(balance * 0.05 * (1 / 12));
      const at = daysAgo(m * 30);

      balance = round2(balance + dep - wd + int);
      deposits = round2(deposits + dep);
      withdrawals = round2(withdrawals + wd);
      interest = round2(interest + int);

      const moves = [
        { type: "DEPOSIT" as const, amt: dep, nar: "Monthly savings top-up" },
        { type: "WITHDRAWAL" as const, amt: wd, nar: "Withdrawal for stock" },
        { type: "INTEREST" as const, amt: int, nar: "Monthly interest" },
      ];

      for (const t of moves) {
        if (t.amt <= 0) continue;
        await prisma.savingsTransaction.create({
          data: {
            savingsId: savings.id,
            type: t.type,
            amount: t.amt,
            balanceAfter: balance,
            narration: t.nar,
            simulated: true,
            createdAt: at,
          },
        });
        const legs =
          t.type === "DEPOSIT"
            ? savingsDepositLegs(t.amt)
            : t.type === "WITHDRAWAL"
              ? savingsWithdrawalLegs(t.amt)
              : [
                  {
                    accountCode: "SAVINGS" as const,
                    direction: "CREDIT" as const,
                    amount: t.amt,
                    narration: "Interest credited",
                  },
                  {
                    accountCode: "PLATFORM_REVENUE" as const,
                    direction: "DEBIT" as const,
                    amount: t.amt,
                    narration: "Interest cost",
                  },
                ];
        await post(
          {
            reference: `SAV-${accountNumber}-${m}-${t.type}`,
            type: `SAVINGS_${t.type}`,
            description: t.nar,
            accountCode: "SAVINGS",
            amount: t.amt,
            smeId: s.sme.id,
            simulated: true,
            postedAt: at,
          },
          legs,
          prisma,
        );
      }
    }

    await prisma.savings.update({
      where: { smeId: s.sme.id },
      data: {
        balance,
        totalDeposits: deposits,
        totalWithdrawals: withdrawals,
        interestEarned: interest,
      },
    });
  }
  console.log("  savings: done");
}

async function seedBnpl(smes: Seeded[], customers: Array<{ id: string }>) {
  let count = 0;
  for (let i = 0; i < 15; i++) {
    const s = smes[i % 4];
    const cust = customers[int(rng, 0, customers.length - 1)];
    const product = s.products[int(rng, 0, s.products.length - 1)];
    const qty = int(rng, 1, 3);
    const total = round2(product.price * qty);
    const financed = round2(total * 0.8);
    const installments = pick(rng, [3, 4, 6]);
    const reference = `BNPL-2026-${String(2000 + i)}`;

    const plan = await prisma.bNPL.upsert({
      where: { reference },
      update: {},
      create: {
        reference,
        customerId: cust.id,
        smeId: s.sme.id,
        totalAmount: total,
        downPayment: round2(total - financed),
        financedAmount: financed,
        installmentCount: installments,
        frequency: "MONTHLY",
        status: "ACTIVE",
        approvedAt: daysAgo(int(rng, 10, 90)),
        simulated: true,
        items: {
          create: [
            { productId: product.id, quantity: qty, unitPrice: product.price, lineTotal: total },
          ],
        },
      },
    });

    await post(
      {
        reference: `BNPL-${reference}`,
        type: "BNPL_FINANCED",
        description: `BNPL plan ${reference}`,
        accountCode: "BNPL_RECEIVABLE",
        amount: financed,
        smeId: s.sme.id,
        customerId: cust.id,
        simulated: true,
      },
      bnplLegs(financed),
      prisma,
    );

    const per = round2(financed / installments);
    for (let k = 1; k <= installments; k++) {
      const dueDate = daysAgo(90 - k * 30);
      const paid = dueDate < new Date() && chance(rng, 0.8);
      await prisma.bNPLInstallment.upsert({
        where: { bnplId_installmentNumber: { bnplId: plan.id, installmentNumber: k } },
        update: {},
        create: {
          bnplId: plan.id,
          installmentNumber: k,
          amountDue: per,
          amountPaid: paid ? per : 0,
          status: paid ? "PAID" : dueDate < new Date() ? "OVERDUE" : "SCHEDULED",
          dueDate,
          paidAt: paid ? dueDate : null,
          mpesaReceipt: paid ? `QJG${int(rng, 100000, 999999)}` : null,
          simulated: true,
        },
      });
    }
    count++;
  }
  console.log(`  bnpl plans: ${count}`);
}


async function seedOrders(smes: Seeded[], suppliers: Array<{ id: string }>) {
  let count = 0;
  for (let i = 0; i < smes.length; i++) {
    const s = smes[i];
    for (let n = 0; n < 20; n++) {
      const supplier = suppliers[int(rng, 0, suppliers.length - 1)];
      const product = s.products[int(rng, 0, s.products.length - 1)];
      const qty = int(rng, 5, 60);
      const total = round2(product.cost * qty);
      const status = pick(rng, [
        "PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED",
      ] as const);
      const placed = daysAgo(int(rng, 1, 180));
      const orderNumber = `ORD-2026-${i + 1}-${n + 1}`;

      const order = await prisma.order.upsert({
        where: { orderNumber },
        update: {},
        create: {
          orderNumber,
          smeId: s.sme.id,
          supplierId: supplier.id,
          status,
          totalAmount: total,
          placedAt: placed,
          confirmedAt: status === "PENDING" ? null : new Date(placed.getTime() + 86400000),
          shippedAt: ["SHIPPED", "DELIVERED"].includes(status)
            ? new Date(placed.getTime() + 3 * 86400000)
            : null,
          deliveredAt:
            status === "DELIVERED" ? new Date(placed.getTime() + 6 * 86400000) : null,
          items: {
            create: [
              { productId: product.id, quantity: qty, unitPrice: product.cost, lineTotal: total },
            ],
          },
        },
      });

      if (status === "DELIVERED" || status === "SHIPPED") {
        const paid = chance(rng, 0.7);
        const invNumber = `INV-2026-${i + 1}-${n + 1}`;
        await prisma.invoice.upsert({
          where: { invoiceNumber: invNumber },
          update: {},
          create: {
            invoiceNumber: invNumber,
            smeId: s.sme.id,
            supplierId: supplier.id,
            orderId: order.id,
            status: paid ? "PAID" : "DUE",
            subtotal: total,
            totalAmount: total,
            amountPaid: paid ? total : 0,
            dueDate: new Date(placed.getTime() + 30 * 86400000),
            paidAt: paid ? new Date(placed.getTime() + 10 * 86400000) : null,
            simulated: true,
            items: {
              create: [
                {
                  productId: product.id,
                  description: product.name,
                  quantity: qty,
                  unitPrice: product.cost,
                  lineTotal: total,
                },
              ],
            },
          },
        });
      }
      count++;
    }
  }
  console.log(`  orders + invoices: ${count}`);
}

async function seedSubscriptions(smes: Seeded[]) {
  for (const s of smes) {
    for (let m = 2; m >= 0; m--) {
      await post(
        {
          reference: `SUB-${s.sme.id.slice(-6)}-${m}`,
          type: "SUBSCRIPTION",
          description: "Monthly SME platform subscription",
          accountCode: "SME_WALLET",
          amount: SUBSCRIPTION_AMOUNT,
          smeId: s.sme.id,
          simulated: true,
          postedAt: daysAgo(m * 30),
        },
        subscriptionLegs(SUBSCRIPTION_AMOUNT),
        prisma,
      );
    }
  }
  console.log("  subscriptions: done");
}


async function seedInsights(smes: Seeded[]) {
  let count = 0;
  for (const s of smes) {
    const agg = await prisma.sale.aggregate({
      where: { smeId: s.sme.id, soldAt: { gte: daysAgo(30) } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const revenue = Number(agg._sum.totalAmount ?? 0);
    const lowStock = await prisma.product.count({
      where: { smeId: s.sme.id, isActive: true, stockQuantity: { lte: 20 } },
    });
    const sparse = agg._count._all < 10;

    await prisma.insight.create({
      data: {
        smeId: s.sme.id,
        type: "REVENUE",
        title: sparse
          ? "Not enough trading history yet"
          : `Revenue trend: KES ${Math.round(revenue).toLocaleString()} in 30 days`,
        body: sparse
          ? "We need roughly 90 days of consistent sales before we can produce a reliable forecast. Keep recording sales at the till."
          : `You recorded ${agg._count._all} sales in the last 30 days. Momentum is ${revenue > 150000 ? "strong" : revenue > 70000 ? "steady" : "soft"}; consider a promotion if sales are slowing.`,
        payload: { revenue30d: revenue, sales30d: agg._count._all, sparse },
        priority: sparse ? 1 : 3,
        model: "rule-based-v1",
      },
    });
    count++;

    if (lowStock > 0) {
      await prisma.insight.create({
        data: {
          smeId: s.sme.id,
          type: "INVENTORY",
          title: `${lowStock} product${lowStock === 1 ? "" : "s"} low on stock`,
          body: "Review your reorder list. Fast movers with thin cover risk a stockout, which directly costs revenue.",
          payload: { lowStock },
          priority: 2,
          model: "rule-based-v1",
        },
      });
      count++;
    }
  }
  console.log(`  insights: ${count}`);
}

async function seedNotifications(smes: Seeded[]) {
  let count = 0;
  for (const s of smes) {
    const loans = await prisma.loan.findMany({ where: { smeId: s.sme.id } });
    for (const loan of loans) {
      await prisma.notification.create({
        data: {
          userId: s.sme.userId,
          smeId: s.sme.id,
          type: "LOAN_UPDATE",
          title: `Loan ${loan.loanNumber} is ${loan.status.replace(/_/g, " ").toLowerCase()}`,
          body:
            loan.status === "PENDING_REVIEW"
              ? "Your application is in the review queue."
              : loan.status === "APPROVED"
                ? "Approved. Disbursement awaits a licensed lending partner, so no funds have moved yet."
                : "Your loan is progressing. Check the schedule in your dashboard.",
          href: "/loans",
          isRead: chance(rng, 0.4),
        },
      });
      count++;
    }
    await prisma.notification.create({
      data: {
        userId: s.sme.userId,
        smeId: s.sme.id,
        type: "INSIGHT",
        title: "New business insight available",
        body: "Your 30-day performance summary and stock cover warnings are ready.",
        href: "/insights",
        isRead: false,
      },
    });
    count++;
  }
  console.log(`  notifications: ${count}`);
}

/**
 * SwiftPOS: one open till per business, plus a receipt against each business's
 * most recent real sales.
 *
 * Receipts point at sales that already exist rather than at invented ones, so
 * the figures printed on a receipt reconcile against the sales ledger.
 * `receiptNumber` continues from the highest in use so a re-run never collides
 * with a row the POS printed at runtime.
 */
async function seedPos(smes: Seeded[]) {
  let tills = 0;
  let receipts = 0;

  for (const s of smes) {
    const exists = await prisma.till.findFirst({
      where: { smeId: s.sme.id, name: "Main Till" },
    });
    if (exists) continue;
    await prisma.till.create({
      data: {
        smeId: s.sme.id,
        name: "Main Till",
        status: "open",
        openingBalance: 25000,
        currentBalance: 35000,
        openedBy: s.sme.businessName,
        openedAt: daysAgo(30),
        cashIn: 15000,
        cashOut: 5000,
      },
    });
    tills++;
  }

  const maxNo = (await prisma.receipt.aggregate({ _max: { receiptNumber: true } }))._max
    .receiptNumber;
  let nextNo = (maxNo ?? 1000) + 1;

  for (const s of smes) {
    const sales = await prisma.sale.findMany({
      where: { smeId: s.sme.id },
      orderBy: { soldAt: "desc" },
      take: 3,
    });
    for (const sale of sales) {
      if (await prisma.receipt.findFirst({ where: { saleId: sale.id } })) continue;
      await prisma.receipt.create({
        data: {
          saleId: sale.id,
          receiptNumber: nextNo++,
          subtotal: sale.totalAmount,
          tax: 0,
          total: sale.totalAmount,
          paymentMethod: String(sale.paymentMethod),
          createdAt: sale.soldAt,
        },
      });
      receipts++;
    }
  }

  console.log(`  pos: tills ${tills} | receipts ${receipts}`);
}

/**
 * Neobank: accounts, cards, crypto wallets, investments and cover.
 *
 * Accounts are opened for customers as well as businesses on purpose — a
 * payment between two parties needs a destination that is not the payer, and
 * without customer accounts `/api/payments/p2p` has nothing to resolve.
 *
 * Account numbers are derived from a stable sequence, so a re-run finds the
 * row it opened last time instead of opening a second one and stranding the
 * first. That is the difference between this and the append-only bug it sits
 * next to.
 */
async function seedNeobank(
  smes: Seeded[],
  customers: Array<{ id: string; userId: string; fullName: string }>,
) {
  const holders = [
    ...smes.map((s) => ({ userId: s.sme.userId, tier: "sme" as const })),
    ...customers.slice(0, 8).map((c) => ({ userId: c.userId, tier: "cust" as const })),
  ];

  const plans = {
    sme: [
      { name: "Operating Account", balance: 850000 },
      { name: "Till Float", balance: 50000 },
    ],
    cust: [{ name: "Personal Account", balance: 25000 }],
  } as const;

  let accounts = 0;
  let cards = 0;
  let wallets = 0;
  let investments = 0;
  let policies = 0;
  let seq = 1;

  for (const h of holders) {
    for (const plan of plans[h.tier]) {
      const accountNumber = `KORA${String(seq++).padStart(8, "0")}`;
      let acct = await prisma.account.findUnique({ where: { accountNumber } });

      if (!acct) {
        acct = await prisma.account.create({
          data: {
            userId: h.userId,
            accountName: plan.name,
            accountType: "CURRENT",
            accountNumber,
            balance: plan.balance,
            currency: "KES",
          },
        });
        accounts++;
      }

      const hasCard = await prisma.card.findFirst({
        where: { accountId: acct.id, cardName: "Virtual Debit" },
      });
      if (hasCard) continue;

      await prisma.card.create({
        data: {
          userId: h.userId,
          accountId: acct.id,
          cardName: "Virtual Debit",
          cardType: "VIRTUAL",
          lastFourDigits: String(1000 + ((seq * 37) % 9000)),
          expiryMonth: ((seq * 5) % 12) + 1,
          expiryYear: new Date().getFullYear() + 3,
        },
      });
      cards++;
    }
  }

  const holdings = [
    { symbol: "USDT", name: "Tether", type: "crypto", quantity: "2500.00000000", averagePrice: "1.00" },
    { symbol: "BTC", name: "Bitcoin", type: "crypto", quantity: "0.08500000", averagePrice: "64000.00" },
  ];

  for (const h of holders.slice(0, 10)) {
    for (const w of holdings) {
      const existing = await prisma.cryptoWallet.findUnique({
        where: { userId_symbol: { userId: h.userId, symbol: w.symbol } },
      });
      if (existing) continue;
      await prisma.cryptoWallet.create({
        data: { userId: h.userId, symbol: w.symbol, balance: w.quantity },
      });
      wallets++;
    }

    // Investments and cover are the higher tiers' showcase; keeping them off
    // customer accounts stops the free tier reading as if it had them too.
    if (h.tier !== "sme") continue;

    for (const inv of [
      { symbol: "BRK", name: "Britam Holdings", type: "equity", quantity: "50.00000000", averagePrice: "420.00" },
      { symbol: "SCOM", name: "Safaricom", type: "equity", quantity: "300.00000000", averagePrice: "28.50" },
    ]) {
      if (await prisma.investment.findFirst({ where: { userId: h.userId, symbol: inv.symbol } }))
        continue;
      await prisma.investment.create({ data: { userId: h.userId, ...inv } });
      investments++;
    }

    if (await prisma.insurancePolicy.findFirst({ where: { userId: h.userId } })) continue;
    await prisma.insurancePolicy.create({
      data: {
        userId: h.userId,
        policyName: "Business Interruption Cover",
        policyType: "BUSINESS",
        provider: "Kenya Fortress",
        premium: 12000,
        status: "active",
        expiryDate: daysAgo(-365),
      },
    });
    policies++;
  }

  console.log(
    `  neobank: accounts ${accounts} | cards ${cards} | wallets ${wallets} | investments ${investments} | policies ${policies}`,
  );
}

/**
 * Clear the generated half of the dataset so a re-run regenerates it instead
 * of appending a second copy.
 *
 * Everything keyed by `upsert` (users, SMEs, products, loans, orders, savings)
 * is left alone — it already converges. The rows that are *appended* are the
 * ones removed here, following the same rule the SubscriptionEvent cleanup
 * above states: only what this seed wrote may go, so a real change made in the
 * admin console survives a re-seed.
 *
 * The ledger is deliberately NOT cleared. `postBatch` dedupes on a
 * deterministic reference (`SALE-<sme>-<day>-<n>`), so re-posting skips headers
 * that already exist and fills only the gaps; dropping those headers would
 * strand the repayments and installments that point at them.
 */
async function resetGenerated(smes: Seeded[]) {
  const smeIds = smes.map((s) => s.sme.id);
  const userIds = smes.map((s) => s.sme.userId);

  // Receipts carry `saleId` as a bare column with no foreign key, so deleting
  // the sales below would strand them. Scope by the sale's own flag rather than
  // truncating the table: a receipt printed through the POS against a real sale
  // must outlive a re-seed.
  // `Receipt.saleId` has no `@map`, so unlike every other column here the
  // physical column keeps its camelCase name and has to be quoted.
  await prisma.$executeRaw`
    DELETE FROM kora.receipts
    WHERE "saleId" IN (SELECT id FROM kora.sales WHERE simulated = true)
  `;

  // SaleItem cascades from Sale, but removing them first keeps the plan explicit
  // rather than leaving it to the database to discover mid-transaction.
  await prisma.saleItem.deleteMany({ where: { sale: { simulated: true } } });
  await prisma.sale.deleteMany({ where: { simulated: true } });
  await prisma.savingsTransaction.deleteMany({ where: { simulated: true } });

  // Savings carries `accountNumber` derived from the *array index* while the
  // upsert keys on `smeId`, and its `update: {}` never reconciles the two. Once
  // a row lands on the wrong index the pair drifts apart and every later run
  // trips the unique constraint — which is exactly how this was found. The
  // balance is rebuilt from the transactions removed above, so dropping the
  // parent loses nothing that is not regenerated immediately below.
  await prisma.savings.deleteMany({ where: { smeId: { in: smeIds } } });

  // Credit scores, insights and notifications carry no `simulated` column, so
  // they are scoped by owning SME instead — a platform-level notification
  // (billing, security) written outside these businesses is preserved. The
  // unconditional `creditScore.deleteMany()` that `--rescore` has always done
  // is the precedent for regenerating them wholesale.
  await prisma.creditScore.deleteMany({ where: { smeId: { in: smeIds } } });
  await prisma.insight.deleteMany({ where: { smeId: { in: smeIds } } });
  await prisma.notification.deleteMany({
    where: { OR: [{ smeId: { in: smeIds } }, { userId: { in: userIds } }] },
  });
}

async function main() {
  // The seed writes the shared demo password into every account as a REAL
  // hash (`upsertUser`), so unlike the demo-login override those accounts
  // would keep signing in with it in production even though demo mode is off.
  // Refuse here unless a second, deliberate opt-in is present — same
  // two-key pattern as `demoLoginEnabled()` in @kora/auth.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.KORA_SEED_ALLOW_PRODUCTION !== "true"
  ) {
    console.error(
      "Refusing to seed a production database.\n" +
        "The demo dataset creates accounts whose password is the shared demo\n" +
        "one, stored as a real hash that stays valid after demo mode is off.\n" +
        "If you really mean it, re-run with KORA_SEED_ALLOW_PRODUCTION=true.",
    );
    process.exit(1);
  }

  console.log(`Seeding ${BRAND.name} demo dataset...`);
  console.log(
    `  history: ${DAYS_OF_HISTORY} days | fee: KES ${PLATFORM_FEE} | subscription: KES ${SUBSCRIPTION_AMOUNT}`,
  );

  // Seeding is expected to be re-run against the same database. `setUserPlan`
  // appends a `SubscriptionEvent` on every call, so without this the audit
  // trail would gain one identical row per account per run and stop being
  // readable. Only rows this seed wrote are removed, so a genuine billing
  // change made in the admin console keeps its history.
  await prisma.subscriptionEvent.deleteMany({
    where: { reason: { startsWith: "Seeded demo plan" } },
  });

  const rescoreOnly = process.argv.includes("--rescore");

  // Has to happen before the first `phoneFor` call: it is what stops a number
  // derived for one account from landing on a row another account still holds.
  await primePhoneBook();

  const admin = await upsertUser({
    email: `admin@${BRAND.demoDomain}`,
    fullName: `${BRAND.name} Platform Admin`,
    phone: phoneFor(`admin@${BRAND.demoDomain}`),
    role: "ADMIN",
  });
  console.log("  admin user: ready");

  const suppliers = await seedSuppliers();
  const smes = await seedSmes(suppliers);

  if (rescoreOnly) {
    // Recompute credit scores against the existing sales history, leaving
    // the 30k sales rows, savings, BNPL and orders untouched.
    const customers = await seedCustomers();
    void customers;
    await prisma.creditScore.deleteMany();
    await prisma.loan.deleteMany();
    await seedCredit(smes, admin.id);
  } else {
    // Reset before writing, not after: a failure mid-seed must not leave the
    // previous run's data half-deleted with nothing to replace it.
    await resetGenerated(smes);
    const customers = await seedCustomers();
    await seedSalesHistory(smes, customers);
    await seedSavings(smes);
    await seedBnpl(smes, customers);
    await seedCredit(smes, admin.id);
    await seedOrders(smes, suppliers);
    await seedSubscriptions(smes);
    await seedInsights(smes);
    await seedNotifications(smes);
    await seedPos(smes);
    await seedNeobank(smes, customers);
  }

  const [sales, loans, txns, simTxns, pending] = await Promise.all([
    prisma.sale.count(),
    prisma.loan.count(),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { simulated: true } }),
    prisma.loan.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  console.log("\nSummary:");
  console.log(`  sales: ${sales} | loans: ${loans} (${pending} awaiting review)`);
  console.log(`  ledger txns: ${txns} | all simulated: ${simTxns === txns}`);
  console.log(`\nSign in (password: ${DEMO_PASSWORD}):`);
  console.log(
    `  admin@${BRAND.demoDomain} | sme1@${BRAND.demoDomain} | supplier1@${BRAND.demoDomain} | customer1@${BRAND.demoDomain}`,
  );
  console.log("\nEntitlement ladder - sign in as each and open /apps to compare:");
  console.log("  sme1  METAL    -> SalesPilot + SwiftPOS + Neobank, also a supplier and a customer");
  console.log("  sme2  STANDARD -> SalesPilot + SwiftPOS, also a supplier");
  console.log("  sme3  FREE     -> SalesPilot only");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("SEED FAILED:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

