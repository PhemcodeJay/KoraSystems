import { prisma, type Prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Refunds for sales belonging to the caller. Scoped through the sale, since a
 * refund row itself only carries a saleId.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");

  // Refund.saleId is a plain column, not a relation, so the tenant boundary
  // is resolved by first collecting the sales this business owns.
  let saleIds: string[] | undefined;
  if (!scope.isAdmin) {
    const sales = await prisma.sale.findMany({
      where: { smeId: scope.smeId ?? "__none__" },
      select: { id: true },
    });
    saleIds = sales.map((s) => s.id);
  }

  const where: Prisma.RefundWhereInput = saleIds ? { saleId: { in: saleIds } } : {};

  const refunds = await prisma.refund.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(refunds);
}

/**
 * Refund a sale. The sale must belong to the caller's business and must not
 * already be fully refunded, otherwise a signed-in SME could refund another
 * business's sale or over-refund its own.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const body = await request.json();

  if (!body.saleId) {
    return NextResponse.json({ error: "saleId is required." }, { status: 400 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id: body.saleId },
    select: { id: true, smeId: true, totalAmount: true },
  });
  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  if (!scope.isAdmin && sale.smeId !== scope.smeId) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  const already = await prisma.refund.aggregate({
    where: { saleId: sale.id },
    _sum: { amount: true },
  });
  const refunded = Number(already._sum.amount ?? 0);
  const total = Number(sale.totalAmount);
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required." }, { status: 400 });
  }
  if (refunded + amount > total) {
    return NextResponse.json(
      { error: `Refund exceeds the remaining balance of KES ${(total - refunded).toFixed(2)}.` },
      { status: 400 },
    );
  }

  const refund = await prisma.refund.create({
    data: { saleId: sale.id, amount, reason: body.reason },
  });
  return NextResponse.json(refund, { status: 201 });
}
