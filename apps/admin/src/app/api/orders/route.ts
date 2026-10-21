import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Purchase orders. An SME sees orders it raised, a supplier sees orders placed
 * against it, an admin sees all.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN", "SUPPLIER");

  let where: Record<string, unknown> = {};
  if (!scope.isAdmin) {
    if (scope.smeId) where = { smeId: scope.smeId };
    else if (scope.supplierId) where = { supplierId: scope.supplierId };
    else where = { id: "__none__" };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return NextResponse.json({ data: orders });
}
