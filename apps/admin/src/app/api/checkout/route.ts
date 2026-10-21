import { prisma, Prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { post, saleLegs, money } from "@kora/ledger";
import { NextResponse } from "next/server";

type Line = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  costPrice: number | null;
  smeId: string;
};

/**
 * Customer checkout.
 *
 * The customer cart previously posted to `POST /api/sales`, which is guarded
 * `withAuth("SME","ADMIN")` — a signed-in CUSTOMER got 403 and simply could not
 * buy anything. This route is the customer-scoped equivalent.
 *
 * Two things it does that the old path did not:
 *
 * 1. **Trusts nothing from the client.** Prices, product ownership and stock are
 *    re-read from the database; a tampered `unitPrice` is ignored.
 * 2. **Posts to the double-entry ledger.** `POST /api/sales` created a `Sale`
 *    row and nothing else, so the ledger — the documented source of truth for
 *    money — silently diverged from the sales table. Every sale here writes a
 *    balanced posting via `post()`, which re-asserts debits === credits.
 */
export async function POST(request: Request) {
  // Authorise any signed-in account, then discriminate on the role below.
  //
  // `withAuth("CUSTOMER")` alone tested the single `user.role` column, so a
  // METAL SME was rejected with "This area is for customer accounts." before
  // the handler ever reached its profile check — even though the subscription
  // explicitly grants them the CUSTOMER role. The tier sold a capability the
  // route then refused. Every other route here passes the full role set for
  // exactly this reason; this was the only one that did not.
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  // `requireScope(...)` must be given the same role set as `withAuth` above:
  // it forwards them to `requireRole`, which tests the primary `user.role`
  // column only. Passing "CUSTOMER" alone would reject a granted CUSTOMER
  // outright — the exact shape `requireProfile` avoids by asking for every
  // role and then discriminating with `hasRole`.
  const scope = await requireScope("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (!scope.hasRole("CUSTOMER")) {
    return NextResponse.json(
      { error: "This area is for customer accounts." },
      { status: 403 },
    );
  }
  if (!scope.customerId) {
    return NextResponse.json(
      { error: "No customer profile is linked to this account." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    items?: Array<{ productId: string; quantity: number }>;
    paymentMethod?: string;
  } | null;

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  // Collapse duplicate lines so a product is not validated or stocked twice.
  const wanted = new Map<string, number>();
  for (const line of body.items) {
    const id = String(line?.productId ?? "");
    const qty = Number(line?.quantity);
    if (!id) {
      return NextResponse.json(
        { error: "A cart line is missing its product." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Quantities must be whole numbers greater than zero." },
        { status: 400 },
      );
    }
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Do not confirm that an arbitrary id exists — report the cart as stale.
  for (const id of wanted.keys()) {
    if (!byId.has(id)) {
      return NextResponse.json(
        { error: "One of the items is no longer available. Refresh your cart." },
        { status: 409 },
      );
    }
  }

  const lines: Line[] = [];
  for (const [id, quantity] of wanted) {
    const product = byId.get(id)!;
    if (product.stockQuantity < quantity) {
      return NextResponse.json(
        {
          error:
            product.stockQuantity === 0
              ? `${product.name} is out of stock.`
              : `Only ${product.stockQuantity} of ${product.name} left.`,
        },
        { status: 409 },
      );
    }
    // Server-side price; the client-sent value is deliberately ignored.
    const unitPrice = Number(product.price);
    lines.push({
      productId: product.id,
      quantity,
      unitPrice,
      lineTotal: money(unitPrice * quantity),
      costPrice: product.costPrice === null ? null : Number(product.costPrice),
      smeId: product.smeId,
    });
  }

  const total = money(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  if (total <= 0) {
    return NextResponse.json(
      { error: "That order totals zero." },
      { status: 400 },
    );
  }

  // A cart may span businesses. The ledger is keyed by SME, so each business
  // gets its own balanced posting rather than one attributed to whichever
  // product happened to be first.
  const bySme = new Map<string, Line[]>();
  for (const line of lines) {
    const bucket = bySme.get(line.smeId) ?? [];
    bucket.push(line);
    bySme.set(line.smeId, bucket);
  }

  const reference = `CHK-${Date.now().toString(36).toUpperCase()}`;
  const paymentMethod = normaliseMethod(body?.paymentMethod);
  const created: Array<{ saleId: string; smeId: string; total: number }> = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const [smeId, smeLines] of bySme) {
          const subtotal = money(
            smeLines.reduce((sum, l) => sum + l.lineTotal, 0),
          );
          const postingRef = `${reference}-${smeId.slice(-4)}`;

          // Debit the SME wallet, credit revenue. `post()` re-asserts balance
          // before writing, so a builder bug cannot half-apply a posting.
          const header = await post(
            {
              reference: postingRef,
              type: "SALE",
              description: `Customer sale · ${smeLines.length} line(s)`,
              accountCode: "SME_WALLET",
              amount: subtotal,
              customerId: scope.customerId,
              smeId,
              // No real money moves: the M-Pesa call is gated separately.
              simulated: true,
              metadata: { source: "checkout", customerId: scope.customerId },
            },
            saleLegs(subtotal, 0),
            tx as never,
          );

          const sale = await tx.sale.create({
            data: {
              smeId,
              customerId: scope.customerId,
              totalAmount: subtotal,
              paymentMethod,
              paymentStatus: "COMPLETED",
              platformFee: 0,
              simulated: true,
              // Link the sale to its ledger header so the two cannot drift.
              transactionId: header.transactionId,
              items: {
                create: smeLines.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  lineTotal: l.lineTotal,
                  costPrice: l.costPrice,
                })),
              },
            },
            select: { id: true },
          });

          for (const l of smeLines) {
            await tx.product.update({
              where: { id: l.productId },
              data: { stockQuantity: { decrement: l.quantity } },
            });
          }

          await tx.customer.update({
            where: { id: scope.customerId },
            data: {
              totalSpend: { increment: subtotal },
              purchaseCount: { increment: 1 },
              // 1 loyalty point per whole KES 10 spent.
              loyaltyPoints: { increment: Math.floor(subtotal / 10) },
            },
          });

          created.push({ saleId: sale.id, smeId, total: subtotal });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // A serialisation failure means two checkouts raced on the same stock, so
    // the whole order is rolled back rather than half-applied.
    const raced =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034";
    return NextResponse.json(
      {
        error: raced
          ? "Someone bought the last of that stock first. Please try again."
          : "We could not complete that checkout. Please try again.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { data: { reference, total, paymentMethod, orders: created } },
    { status: 201 },
  );
}

/** Only methods the schema accepts; anything else becomes CASH. */
function normaliseMethod(
  value: unknown,
): "CASH" | "MPESA_STK" | "WALLET" | "CARD" {
  const allowed = ["CASH", "MPESA_STK", "WALLET", "CARD"] as const;
  const upper = String(value ?? "").toUpperCase();
  return (allowed as readonly string[]).includes(upper)
    ? (upper as (typeof allowed)[number])
    : "CASH";
}