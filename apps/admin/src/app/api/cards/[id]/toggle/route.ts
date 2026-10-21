import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const cards = await prisma.card.findMany({
      where: { userId: auth.user.id },
    });
    const card = cards.find(c => c.id === params.id);
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    const updatedCard = await prisma.card.update({
      where: { id: card.id },
      data: { isActive: !card.isActive },
    });
    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}