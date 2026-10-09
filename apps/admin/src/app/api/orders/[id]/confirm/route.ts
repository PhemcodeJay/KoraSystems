import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Move an order to Confirm.
 *
 * The supplier UI has always offered this action but the route did not exist,
 * so the button silently did nothing.
 *
 * Scoped: an SME can only advance orders it raised, and a supplier only those
 * placed against it. Each transition checks the current status, so a replayed
 * or out-of-order request is refused rather than corrupting the order.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN", "SUPPLIER");

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, smeId: true, supplierId: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!scope.isAdmin) {
    const permitted =
      (scope.smeId !== undefined && order.smeId === scope.smeId) ||
      (scope.supplierId !== undefined && order.supplierId === scope.supplierId);
    if (!permitted) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
  }

  if (order.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "This order is " + String(order.status).toLowerCase() + " and cannot be confirmd." },
      { status: 409 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMED" },
  });

  return NextResponse.json({ data: updated });
}
