import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Suppliers.
 *
 * ADMIN sees all; a SUPPLIER sees only itself; an SME sees only the suppliers
 * it actually has a relationship with — those supplying its products or
 * receiving its purchase orders.
 *
 * Supplier has no smeId either, so the scope is resolved through Product and
 * Order, both of which carry smeId directly. Returning Supplier rows
 * unfiltered would expose every vendor's contact details to every business.
 */
export async function GET() {
  const auth = await withAuth("ADMIN", "SUPPLIER", "SME");
  if (auth.response) return auth.response;

  const scope = await requireScope("ADMIN", "SUPPLIER", "SME");

  const select = {
    id: true,
    companyName: true,
    rating: true,
    ratingCount: true,
    county: true,
    town: true,
    contactPhone: true,
    createdAt: true,
    user: { select: { email: true, fullName: true, isActive: true } },
    _count: { select: { products: true, orders: true } },
  } as const;

  if (scope.isAdmin) {
    return NextResponse.json(
      await prisma.supplier.findMany({
        orderBy: { companyName: "asc" },
        select,
      }),
    );
  }

  if (scope.supplierId) {
    return NextResponse.json(
      await prisma.supplier.findMany({
        where: { id: scope.supplierId },
        select,
      }),
    );
  }

  const smeId = scope.smeId ?? "__none__";

  // Two independent paths to the same suppliers: those whose products this SME
  // stocks, and those it has placed purchase orders with. Union them so a
  // vendor met only through an order is not missing from the list.
  const [productRows, orderRows] = await Promise.all([
    prisma.product.findMany({
      where: { smeId },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
    prisma.order.findMany({
      where: { smeId },
      select: { supplierId: true },
      distinct: ["supplierId"],
    }),
  ]);

  const ids = [
    ...new Set(
      [...productRows, ...orderRows]
        .map((r) => r.supplierId)
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  if (ids.length === 0) return NextResponse.json([]);

  return NextResponse.json(
    await prisma.supplier.findMany({
      where: { id: { in: ids } },
      orderBy: { companyName: "asc" },
      select,
    }),
  );
}