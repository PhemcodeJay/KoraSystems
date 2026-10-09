import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Customers.
 *
 * ADMIN sees all; a CUSTOMER sees only itself; an SME sees only the customers
 * who have actually bought from it.
 *
 * The SME case is resolved through Sale, because Customer has no smeId column
 * — there is no direct tenant key to filter on. "Customers with at least one
 * sale of mine" is the only honest scope; returning Customer rows unfiltered
 * would expose every shopper's email and phone to every business on the
 * platform.
 *
 * PII (email, loyalty tier) is intentionally included — this route is for
 * platform staff, the account holder viewing themselves, and the businesses
 * that sold to them.
 */
export async function GET() {
  const auth = await withAuth("ADMIN", "CUSTOMER", "SME");
  if (auth.response) return auth.response;

  const scope = await requireScope("ADMIN", "CUSTOMER", "SME");

  const select = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    county: true,
    town: true,
    loyaltyPoints: true,
    loyaltyTier: true,
    createdAt: true,
    user: { select: { email: true, fullName: true, isActive: true } },
    _count: { select: { sales: true, bnplPlans: true } },
  } as const;

  if (scope.isAdmin) {
    return NextResponse.json(
      await prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select,
      }),
    );
  }

  if (scope.customerId) {
    return NextResponse.json(
      await prisma.customer.findMany({
        where: { id: scope.customerId },
        select,
      }),
    );
  }

  // SME: resolve the caller's own sale ids first, then filter customers by
  // those sales. Customer has no smeId, so filtering on one would not compile
  // — which is exactly the guard that keeps a bad scope from shipping.
  const saleIds = (
    await prisma.sale.findMany({
      where: { smeId: scope.smeId ?? "__none__" },
      select: { id: true },
    })
  ).map((s) => s.id);

  if (saleIds.length === 0) return NextResponse.json([]);

  return NextResponse.json(
    await prisma.customer.findMany({
      where: { sales: { some: { id: { in: saleIds } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select,
    }),
  );
}