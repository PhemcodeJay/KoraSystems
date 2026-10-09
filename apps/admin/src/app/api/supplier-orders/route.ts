import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Supplier orders. An SME sees orders it raised; a supplier sees orders placed
 * against it; an admin sees the platform.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN","SUPPLIER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN","SUPPLIER");

  let where: Record<string, unknown> = {};
  if (!scope.isAdmin) {
    if (scope.smeId) where = { smeId: scope.smeId };
    else if (scope.supplierId) where = { supplierId: scope.supplierId };
    else where = { id: "__none__" };
  }

  const orders = await prisma.supplierOrder.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(orders);
}

/**
 * Raise a supplier order. `smeId` comes from the caller's own business record,
 * never the request body, so an SME cannot place orders on another business's
 * behalf.
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

  if (!body.supplierId) {
    return NextResponse.json({ error: "supplierId is required." }, { status: 400 });
  }

  const order = await prisma.supplierOrder.create({
    data: {
      orderNumber: body.orderNumber,
      supplierId: body.supplierId,
      smeId,
      totalAmount: body.totalAmount,
      items: body.items,
    },
  });
  return NextResponse.json(order, { status: 201 });
}
