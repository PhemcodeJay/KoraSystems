import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

// GET /api/banking/cards - Get user's cards
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const cards = await prisma.card.findMany({
    where: auth.user.role === "ADMIN" ? {} : { userId: auth.user.id },
    include: { account: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ cards });
}

// POST /api/banking/cards - Create a new card
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { name, type, accountId } = await req.json();
    const card = await prisma.card.create({
      data: {
        userId: auth.user.id,
        accountId,
        cardName: name,
        cardType: type,
        lastFourDigits: Math.floor(1000 + Math.random() * 9000).toString(),
        expiryMonth: new Date().getMonth() + 1,
        expiryYear: new Date().getFullYear() + 4,
        isActive: true,
      },
    });
    return NextResponse.json({ card });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
