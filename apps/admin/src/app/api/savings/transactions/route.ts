import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/** Savings movements for the caller's own account. */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");

  const transactions = await prisma.savingsTransaction.findMany({
    where: scope.isAdmin
      ? {}
      : { savings: { smeId: scope.smeId ?? "__none__" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: transactions });
}
