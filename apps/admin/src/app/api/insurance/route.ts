import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

// GET /api/dashboard/insurance - Get user's insurance policies
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const policies = await prisma.insurancePolicy.findMany({
    where: auth.user.role === "ADMIN" ? {} : { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ policies });
}

// POST /api/insurance/purchase - Purchase an insurance policy
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { title, type, premium, paymentToken } = await req.json();

    // Deduct from crypto wallet if payment token specified
    if (paymentToken && premium) {
      const token = String(paymentToken).toUpperCase();
      const wallet = await prisma.cryptoWallet.findFirst({
        where: { userId: auth.user.id, symbol: token },
      });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
      if (balance < parseFloat(premium)) {
        return NextResponse.json({ error: `Insufficient ${token} balance` }, { status: 400 });
      }
      const newBal = (balance - parseFloat(premium)).toFixed(8);
      await prisma.cryptoWallet.update({
        where: { id: wallet!.id },
        data: { balance: newBal },
      });
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        userId: auth.user.id,
        policyName: title,
        policyType: type,
        provider: "Neobank Fortress",
        premium: String(premium ?? "0"),
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      },
    });

    return NextResponse.json({ policy });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
