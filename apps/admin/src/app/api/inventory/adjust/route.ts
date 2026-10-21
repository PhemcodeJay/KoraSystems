import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Record a stock adjustment and apply it to the product.
 *
 * Previously this wrote the StockAdjustment audit row and nothing else, so
 * `stockQuantity` never moved: the audit trail claimed a delivery arrived while
 * the catalogue kept the old count. The two writes run in one transaction so
 * an adjustment is either fully applied or not applied at all.
 *
 * `quantity` is a MAGNITUDE, not a delta — direction comes from
 * `adjustmentType`. Accepting a signed `quantityDelta` and deriving the type
 * from its sign is friendlier to the client and removes the possibility of
 * "out" with a positive number.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const body = await request.json();

  if (!body.productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const delta = Number(body.quantityDelta ?? body.quantity);
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json(
      { error: "Provide a non-zero quantityDelta, e.g. 5 to add or -3 to remove." },
      { status: 400 },
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: { id: true, smeId: true, stockQuantity: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  // 404 rather than 403 so another tenant's product id is not confirmed to exist.
  if (!scope.isAdmin && product.smeId !== scope.smeId) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const nextQty = product.stockQuantity + delta;
  if (nextQty < 0) {
    return NextResponse.json(
      {
        error: `Cannot remove ${Math.abs(delta)} — only ${product.stockQuantity} in stock.`,
      },
      { status: 409 },
    );
  }

  const adjustmentType =
    body.adjustmentType ?? (delta > 0 ? "in" : "out");
  const reason =
    body.reason ??
    (delta > 0 ? "Manual stock-in" : "Manual stock-out");

  const [adjustment] = await prisma.$transaction([
    prisma.stockAdjustment.create({
      data: {
        productId: product.id,
        adjustmentType,
        quantity: Math.abs(delta),
        reason,
        userId: scope.user.id,
      },
    }),
    prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: nextQty },
    }),
  ]);

  return NextResponse.json(
    { ...adjustment, stockQuantity: nextQty },
    { status: 201 },
  );
}