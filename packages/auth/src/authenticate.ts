import { createClient } from "@supabase/supabase-js";
import { prisma } from "@kora/database";
import type { SessionUser } from "./session";
import { hashPassword, needsRehash, validatePasswordStrength, verifyPassword } from "./password";
import { provisionNewUser } from "./entitlement-sync";

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase auth is not configured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.",
    );
  }
  return createClient(url, key);
}

/**
 * Exchange credentials for a user.
 *
 * Three paths, in order:
 *
 * 1. Per-user salted hash (`User.passwordHash`). This is the normal path and
 *    the only one that gives per-account passwords. The hash carries its own
 *    scrypt parameters, so raising the work factor later just rehashes on the
 *    next sign-in rather than invalidating stored passwords.
 *
 * 2. `KORA_DEMO_PASSWORD` — when set, any active account may sign in with this
 *    single shared password. This is what makes the demo dataset reviewable
 *    without 71 separate passwords, and it is gated on an env var so it
 *    cannot be on by accident in production. It is checked *in addition to*
 *    the hash, never instead of it, so an account with a real password set
 *    still accepts its own password.
 *
 * 3. Supabase Auth, when neither of the above applies. This is the production
 *    identity provider; the local `User` row is only a mirror of its profile.
 *
 * On success `lastLoginAt` is stamped. A stale hash is transparently upgraded
 * to current parameters here, so the work factor can be raised without asking
 * anyone to reset a password.
 */
/**
 * Whether the shared demo-password mode is active.
 *
 * Outside production this is simply "is `KORA_DEMO_PASSWORD` set". In
 * production it takes a second, deliberate opt-in — `KORA_ALLOW_DEMO_LOGIN=true`
 * — so that a `.env` copied from a demo host cannot silently let anyone sign
 * in as any account (admin included) with one shared password. An env var
 * alone cannot prevent that: copying files is exactly how accidents happen.
 */
export function demoLoginEnabled(): boolean {
  if (!process.env.KORA_DEMO_PASSWORD) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.KORA_ALLOW_DEMO_LOGIN === "true";
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalisedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalisedEmail },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!user || !user.isActive) return null;

  // 1. The account's own salted hash.
  const hashMatches = await verifyPassword(password, user.passwordHash);

  // 2. Demo override. Separate message paths are irrelevant to the caller —
  //    both return null — so a wrong password never reveals which accounts
  //    have real passwords set. `demoLoginEnabled()` refuses the override in
  //    production unless a second, deliberate opt-in is present.
  const demoPassword = demoLoginEnabled() ? process.env.KORA_DEMO_PASSWORD : undefined;
  const demoMatches = !!demoPassword && password === demoPassword;

  if (!hashMatches && !demoMatches) return null;

  // Opportunistic rehash: only ever on a genuine credential match, so this
  // cannot be used to make the server hash attacker-supplied strings.
  if (hashMatches && needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: upgraded },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Bind pending team invites: an invite created before the account existed
  // carries only the email. The delegate is cast because the generated client
  // only knows `smeMember` after the SaaS migration + `prisma generate`.
  try {
    const seats = (prisma as unknown as Record<string, { updateMany(args: unknown): Promise<unknown> } | undefined>).smeMember;
    if (seats) {
      await seats.updateMany({
        where: { email: normalisedEmail, userId: null, isActive: true },
        data: { userId: user.id },
      });
    }
  } catch {
    // Pre-migration: no seats table yet.
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

export type RegisterInput = {
  role: "SME" | "SUPPLIER" | "CUSTOMER";
  fullName: string;
  email: string;
  phone?: string | null;
  businessName?: string;
  companyName?: string;
  password: string;
};

export type RegisterResult =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; status: number };

/**
 * Self-serve registration.
 *
 * Demo mode (KORA_DEMO_PASSWORD set): creates the User plus its SME /
 * Supplier / Customer profile directly — there are no per-user passwords in
 * this mode, every active account signs in with the shared password.
 *
 * Production: creates the identity in Supabase Auth first (auto-confirmed via
 * the admin API), then mirrors it locally with the same id so `authenticate()`
 * — which looks the local user up by the Supabase uid — keeps working.
 *
 * ADMIN can never self-register here; platform admins are promoted out of
 * band.
 */
export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  // Reject weak passwords before any row is written. Doing this here rather
  // than at the form alone means an API caller cannot bypass it.
  const weak = validatePasswordStrength(input.password);
  if (weak) return { ok: false, error: weak, status: 400 };

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      error: "An account with this email or phone already exists. Sign in instead.",
      status: 409,
    };
  }

  const demoMode = demoLoginEnabled();
  let id: string | undefined;
  let authUserId: string;

  if (demoMode) {
    // No identity provider in demo: local row only.
    authUserId = `local-${email}`;
  } else {
    let supabaseId: string;
    try {
      const { data, error } = await supabaseClient().auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: input.role },
      });
      if (error || !data.user) {
        const message = error?.message ?? "Could not create the account.";
        const status = /already|exists|registered/i.test(message) ? 409 : 400;
        return { ok: false, error: message, status };
      }
      supabaseId = data.user.id;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Could not create the account.",
        status: 500,
      };
    }
    id = supabaseId;
    authUserId = supabaseId;
  }

  try {
    // Hash before the insert so a plaintext password never reaches the
    // database, not even transiently on a rolled-back transaction.
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        ...(id ? { id } : {}),
        authUserId,
        email,
        phone,
        fullName,
        role: input.role,
        passwordHash,
      },
      select: { id: true, email: true, fullName: true, role: true },
    });

    if (input.role === "SME") {
      const sme = await prisma.sME.create({
        data: { userId: user.id, businessName: input.businessName!.trim() },
        select: { id: true },
      });
      // SaaS tenant bootstrap: owner seat + trial row. Best-effort — the
      // tables only exist after the SaaS migration, so a missing-table error
      // must not fail registration itself.
      //
      // New SMEs start on a 90-day GROWTH trial, not the free tier: the landing
      // page sells a "90-day free trial", and this is the one place that makes
      // it real. Growth is the safe tier to trial — SalesPilot + SwiftPOS, no
      // Neobank — so a self-serve signup still cannot reach the money-touching
      // surfaces. The row is written TRIALING with trialEndsAt = now + 90d
      // (from TIERS.STANDARD.limits.trialDays); when it lapses,
      // getTenantSubscription reports EXPIRED and access falls back, so the
      // trial can never become an unpaid paid-plan by standing still.
      try {
        const { provisionTenantSubscription } = await import("./tenant-lifecycle");
        await provisionTenantSubscription(prisma, sme.id, user.id, email, "STANDARD");
      } catch {
        // Pre-migration: UserPlan below is the billing source of truth.
      }
    } else if (input.role === "SUPPLIER") {
      await prisma.supplier.create({
        data: { userId: user.id, companyName: input.companyName!.trim() },
      });
    } else {
      await prisma.customer.create({
        data: { userId: user.id, fullName, email, phone },
      });
    }

    // Every new account starts on the FREE plan, whatever role it registered
    // as, so a paid tier can only ever come from an admin decision.
    await provisionNewUser(prisma, user.id);

    return { ok: true, user };
  } catch (e) {
    // A race between the check above and this write surfaces as P2002.
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return {
        ok: false,
        error: "An account with this email or phone already exists. Sign in instead.",
        status: 409,
      };
    }
    return { ok: false, error: "Could not create the account.", status: 500 };
  }
}

export type DemoAccount = {
  email: string;
  fullName: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
  /** Human label for the linked business/supplier, where one exists. */
  organisation: string | null;
  /** A small set of counts so the picker shows real, differentiated data. */
  stats: { label: string; value: string }[];
};

/**
 * Every seeded demo account, with the data it can actually reach. Used by the
 * sign-in screen so a reviewer can see the dataset is real per role rather
 * than 71 identical logins.
 */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  // The sign-in screen's account picker is a demo affordance. Without demo
  // mode it would expose every seeded account (admin included) on a public
  // production login page, so it goes away with the rest of demo mode.
  if (!demoLoginEnabled()) return [];

  const [smes, suppliers, customers, admin] = await Promise.all([
    prisma.sME.findMany({
      include: {
        _count: { select: { products: true, sales: true, loans: true } },
        user: { select: { email: true, fullName: true, role: true } },
      },
      orderBy: { businessName: "asc" },
    }),
    prisma.supplier.findMany({
      include: {
        _count: { select: { products: true, orders: true } },
        user: { select: { email: true, fullName: true, role: true } },
      },
      orderBy: { companyName: "asc" },
    }),
    prisma.customer.findMany({
      include: {
        _count: { select: { sales: true, bnplPlans: true } },
        user: { select: { email: true, fullName: true, role: true } },
      },
      orderBy: { email: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, fullName: true, role: true },
      take: 1,
    }),
  ]);

  const accounts: DemoAccount[] = [];

  for (const a of admin) {
    accounts.push({
      email: a.email,
      fullName: a.fullName,
      role: a.role,
      organisation: "Kora Systems",
      stats: [
        { label: "Businesses", value: String(smes.length) },
        { label: "Suppliers", value: String(suppliers.length) },
        { label: "Customers", value: String(customers.length) },
      ],
    });
  }

  for (const s of smes) {
    accounts.push({
      email: s.user.email,
      fullName: s.user.fullName,
      role: s.user.role,
      organisation: s.businessName,
      stats: [
        { label: "Products", value: String(s._count.products) },
        { label: "Sales", value: String(s._count.sales) },
        { label: "Loans", value: String(s._count.loans) },
      ],
    });
  }

  for (const s of suppliers) {
    accounts.push({
      email: s.user.email,
      fullName: s.user.fullName,
      role: s.user.role,
      organisation: s.companyName,
      stats: [
        { label: "Products", value: String(s._count.products) },
        { label: "Orders", value: String(s._count.orders) },
        { label: "Rating", value: s.rating.toFixed(1) },
      ],
    });
  }

  for (const c of customers) {
    accounts.push({
      email: c.user.email,
      fullName: c.user.fullName,
      role: c.user.role,
      organisation: null,
      stats: [
        { label: "Purchases", value: String(c._count.sales) },
        { label: "Points", value: String(c.loyaltyPoints) },
        { label: "Tier", value: c.loyaltyTier },
      ],
    });
  }

  return accounts;
}

