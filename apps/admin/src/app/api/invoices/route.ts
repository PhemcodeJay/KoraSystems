import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Invoices for the caller's own business or the orders it supplies.
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

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return NextResponse.json({ data: invoices });
}
