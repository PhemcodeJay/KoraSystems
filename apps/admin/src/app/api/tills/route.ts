import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Tills belonging to the caller.
 *
 * Scoped by smeId. Before that column existed, any signed-in SME received every
 * till on the platform, including its cash balances.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");

  const tills = await prisma.till.findMany({
    where: scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(tills);
}
