import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

// GET /api/crypto/balance - Get total crypto balance
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const wallets = await prisma.cryptoWallet.findMany({
    where: auth.user.role === "ADMIN" ? {} : { userId: auth.user.id },
  });
  const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance.toString()), 0);
  return NextResponse.json({
    wallet: {
      id: auth.user.id,
      balance: totalBalance.toFixed(2),
      currency: "USD",
      wallets,
    },
  });
}