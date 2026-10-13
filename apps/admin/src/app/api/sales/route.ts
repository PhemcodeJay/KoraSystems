import { prisma, Prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { post, saleLegs, money } from "@kora/ledger";
import { NextResponse } from "next/server";

/**
 * Sales visible to the signed-in account.
 *
 * Scoped per role — ADMIN sees the platform, an SME sees only its own sales, a
 * supplier sees sales of the products it supplies, a customer sees its own
 * purchases. Previously every signed-in account received every sale.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN","SUPPLIER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN","SUPPLIER");

  let where: Record<string, unknown> = {};
  if (!scope.isAdmin) {
    if (scope.smeId) {
      where = { smeId: scope.smeId };
    } else if (scope.supplierId) {
      where = { items: { some: { product: { supplierId: scope.supplierId } } } };
    } else {
      // Signed in as a role with no tenant key — show nothing rather than all.
      where = { id: "__none__" };
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: "desc" },
    take: 50,
    include: { items: true },
  });
  return NextResponse.json(sales);
}

/**
 * Record a sale from the point of sale (SwiftPOS).
 *
 * `smeId` is taken from the caller's own SME record, never from the request
 * body — otherwise any signed-in SME could post sales against another
 * business's ledger by supplying someone else's id.
 *
 * ── Why this mirrors `/api/checkout` ────────────────────────────────────────
 * This handler used to trust the client entirely: it required a `customerId`
 * (so a walk-in cash sale could not be rung up at all), took `totalAmount`
 * straight from the body, and created a bare `Sale` row — no line items, no
 * stock decrement, no ledger posting. The POS "Complete sale" button therefore
 * either 400'd ("customerId is required") or, worse, wrote a sale the ledger
 * never saw. It now re-reads prices and stock from the database, ignores any
 * client-sent amount, writes the line items, decrements stock, and posts a
 * balanced ledger entry — all in one serialisable transaction. `customerId` is
 * optional: a walk-in sale is a first-class POS case, not an error.
 */
type SaleLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  costPrice: number | null;
};

const SALE_METHODS = ["CASH", "MPESA_STK", "WALLET", "CARD"] as const;

function normaliseSaleMethod(value: unknown): (typeof SALE_METHODS)[number] {
  const upper = String(value ?? "").toUpperCase();
  return (SALE_METHODS as readonly string[]).includes(upper)
    ? (upper as (typeof SALE_METHODS)[number])
    : "CASH";
}

export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const body = (await request.json().catch(() => null)) as {
    smeId?: string;
    items?: Array<{ productId?: string; quantity?: number }>;
    paymentMethod?: string;
    customerId?: string;
    simulated?: boolean;
    clientId?: string;
  } | null;

  let smeId = body?.smeId as string | undefined;
  if (scope.isAdmin) {
    if (!smeId) {
      return NextResponse.json({ error: "smeId is required." }, { status: 400 });
    }
  } else {
    if (!scope.smeId) {
      return NextResponse.json(
        { error: "No business is linked to this account." },
        { status: 403 },
      );
    }
    smeId = scope.smeId;
  }

  const items = Array.isArray(body?.items) ? body!.items! : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one item to the sale." }, { status: 400 });
  }

  const wanted = new Map<string, number>();
  for (const line of items) {
    const id = String(line?.productId ?? "");
    const qty = Number(line?.quantity);
    if (!id) {
      return NextResponse.json({ error: "A line is missing its product." }, { status: 400 });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Quantities must be whole numbers greater than zero." },
        { status: 400 },
      );
    }
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }

  // SaaS monthly-sales cap, best-effort pre-migration.
  if (smeId && !scope.isAdmin) {
    try {
      const { getTenantSubscription } = await import("@kora/auth/tenant-billing");
      const { limitExceeded } = await import("@kora/auth/tenant-usage");
      const sub = await getTenantSubscription(prisma, smeId);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const used = await prisma.sale.count({ where: { smeId, soldAt: { gte: monthStart } } });
      const check = limitExceeded(sub.tier, "sales", used);
      if (!check.ok) {
        return NextResponse.json(
          { error: check.error, limit: check.limit, used: check.used, upgradeTo: check.upgradeTo },
          { status: 402 },
        );
      }
    } catch {
      // Tenant tables missing — skip the cap.
    }
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, smeId, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of wanted.keys()) {
    if (!byId.has(id)) {
      return NextResponse.json(
        { error: "One of the items is no longer available. Refresh the till." },
        { status: 409 },
      );
    }
  }

  const lines: SaleLine[] = [];
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
    const unitPrice = Number(product.price);
    lines.push({
      productId: product.id,
      quantity,
      unitPrice,
      lineTotal: money(unitPrice * quantity),
      costPrice: product.costPrice === null ? null : Number(product.costPrice),
    });
  }

  const total = money(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  if (total <= 0) {
    return NextResponse.json({ error: "That sale totals zero." }, { status: 400 });
  }

  const paymentMethod = normaliseSaleMethod(body?.paymentMethod);
  const reference = `POS-${smeId.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const simulated = body?.simulated ?? false;

  try {
    const sale = await prisma.$transaction(
      async (tx) => {
        const header = await post(
          {
            reference,
            type: "SALE",
            description: `POS sale · ${lines.length} line(s)`,
            accountCode: "SME_WALLET",
            amount: total,
            customerId: body?.customerId ?? null,
            smeId,
            simulated,
            metadata: { source: "pos", paymentMethod },
          },
          saleLegs(total, 0),
          tx as never,
        );

        const created = await tx.sale.create({
          data: {
            smeId,
            customerId: body?.customerId ?? null,
            totalAmount: total,
            paymentMethod,
            paymentStatus: "COMPLETED",
            platformFee: 0,
            simulated,
            clientId: body?.clientId ?? null,
            transactionId: header.transactionId,
            items: {
              create: lines.map((l) => ({
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

        for (const l of lines) {
          await tx.product.update({
            where: { id: l.productId },
            data: { stockQuantity: { decrement: l.quantity } },
          });
        }

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      { data: { id: sale.id, reference, total, paymentMethod } },
      { status: 201 },
    );
  } catch (error) {
    const raced =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
    return NextResponse.json(
      {
        error: raced
          ? "Someone sold the last of that stock first. Please try again."
          : "We could not record that sale. Please try again.",
      },
      { status: 409 },
    );
  }
}
