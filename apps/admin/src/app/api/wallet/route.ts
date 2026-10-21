import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Wallet balances for the signed-in user.
 *
 * Scoped by userId: ADMIN sees the platform aggregate, everyone else sees only
 * their own wallets. Previously this returned every wallet in the table to any
 * signed-in account.
 */
export async function GET() {
  const auth = await withAuth("SME","ADMIN","SUPPLIER","CUSTOMER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN","SUPPLIER","CUSTOMER");

  const wallets = await prisma.cryptoWallet.findMany({
    where: scope.isAdmin ? {} : { userId: scope.user.id },
  });
  const total = wallets.reduce((s,w) => s + parseFloat(w.balance.toString()), 0);
  return NextResponse.json({wallet:{balance:total.toFixed(2),currency:"KES",wallets}});
}
