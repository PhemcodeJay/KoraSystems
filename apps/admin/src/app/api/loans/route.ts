import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Loans for the caller's own business. Credit data is per-SME and must never
 * be visible across tenants.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const where = scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" };

  const loans = await prisma.loan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: loans });
}
