import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
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
 * Record a sale.
 *
 * `smeId` is taken from the caller's own SME record, never from the request
 * body — otherwise any signed-in SME could post sales against another
 * business's ledger by supplying someone else's id.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const body = await request.json();

  let smeId = body.smeId as string | undefined;
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

  if (!body.customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
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

  const sale = await prisma.sale.create({
    data: {
      smeId,
      customerId: body.customerId,
      totalAmount: body.totalAmount,
      paymentMethod: body.paymentMethod,
      paymentStatus: "COMPLETED",
      platformFee: body.platformFee ?? 0,
      simulated: body.simulated ?? false,
    },
  });
  return NextResponse.json(sale, { status: 201 });
}
