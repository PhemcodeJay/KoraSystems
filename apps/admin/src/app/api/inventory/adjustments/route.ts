import { prisma, type Prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";
export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");

  // StockAdjustment.productId is a plain column, so the tenant boundary is
  // resolved by first collecting the products this business owns.
  let productIds: string[] | undefined;
  if (!scope.isAdmin) {
    const products = await prisma.product.findMany({
      where: { smeId: scope.smeId ?? "__none__" },
      select: { id: true },
    });
    productIds = products.map((p) => p.id);
  }

  const where: Prisma.StockAdjustmentWhereInput = productIds
    ? { productId: { in: productIds } }
    : {};

  const adjustments = await prisma.stockAdjustment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(adjustments);
}

/**
 * Record a stock adjustment. `userId` comes from the session rather than the
 * body, so the audit trail cannot be attributed to another account, and the
 * product must belong to the caller's business.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const body = await request.json();

  if (!body.productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: { id: true, smeId: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (!scope.isAdmin && product.smeId !== scope.smeId) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const adj = await prisma.stockAdjustment.create({
    data: {
      productId: product.id,
      adjustmentType: body.adjustmentType,
      quantity: body.quantity,
      reason: body.reason,
      userId: scope.user.id,
    },
  });
  return NextResponse.json(adj, { status: 201 });
}
