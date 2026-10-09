import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Ledger postings visible to the caller.
 *
 * Money movements are the most sensitive rows in the system, so these are
 * scoped to the caller's own SME unless they are an admin.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const where = scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" };

  const txns = await prisma.transaction.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: 50,
    include: { entries: true },
  });
  return NextResponse.json(txns);
}
