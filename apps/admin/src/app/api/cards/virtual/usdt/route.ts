import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * POST /api/cards/virtual/usdt - Create a USDT virtual card.
 *
 * Split out of `/api/cards` (where it had been exported as a second `POST`
 * named `POSTVirtualUSDT`) because a route file may only export the standard
 * HTTP verbs. A stray named export makes Next.js fail its generated type check
 * and abort the build — and the handler was unreachable besides, since only the
 * canonical `POST` is ever routed. Here it is the real `POST` for this path.
 */
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { name, accountId } = await req.json();
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    const card = await prisma.card.create({
      data: {
        userId: auth.user.id,
        accountId,
        cardName: name || "USDT Card",
        cardType: "virtual",
        lastFourDigits: Math.floor(1000 + Math.random() * 9000).toString(),
        expiryMonth: new Date().getMonth() + 1,
        expiryYear: new Date().getFullYear() + 4,
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, card }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
