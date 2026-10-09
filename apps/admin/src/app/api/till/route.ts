import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * The caller's currently open till.
 *
 * Scoped by smeId — the previous version returned the most recently opened
 * till on the whole platform, so one business could read another's cash
 * position.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");

  const till = await prisma.till.findFirst({
    where: {
      status: "open",
      ...(scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(till ?? { id: 0, status: "closed" });
}
