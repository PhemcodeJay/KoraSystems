import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

// GET /api/dashboard/home - NeoBank dashboard home
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    const accounts = await prisma.account.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
    });

    // Auto-create a default account if none exists
    if (accounts.length === 0) {
      const newAccount = await prisma.account.create({
        data: {
          userId: auth.user.id,
          accountType: "checking",
          accountName: "Personal Checking",
          balance: "2500.00",
          accountNumber: Math.floor(Math.random() * 1000000000).toString(),
          currency: "KES",
        },
      });
      return NextResponse.json({ user, accounts: [newAccount] });
    }

    return NextResponse.json({ user, accounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}