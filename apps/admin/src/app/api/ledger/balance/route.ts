import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { accountBalances } from "@kora/ledger";
import { NextResponse } from "next/server";

/**
 * Account balances aggregated from ledger entries.
 *
 * /api/ledger/balance answers { data: [...] } — the payments page reads it
 * alongside the bare-array /api/ledger/transactions, which is why the shapes
 * differ deliberately. Balances come from the ledger rather than summing
 * Sale/Loan/Savings tables, because those are already represented there and
 * summing both would double count.
 *
 * An SME sees only its own accounts; an admin sees the platform.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const balances = await accountBalances(prisma, {
    smeId: scope.isAdmin ? undefined : scope.smeId,
  });

  return NextResponse.json({ data: balances });
}