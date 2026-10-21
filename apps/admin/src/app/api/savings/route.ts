import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * The caller's savings account. Savings is one-per-SME (smeId is @unique), so
 * a lookup by the caller's own SME id is already the tenant boundary.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");

  const savings = await prisma.savings.findFirst({
    where: scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: savings ?? null });
}
