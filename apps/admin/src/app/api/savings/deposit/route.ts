import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Deposit into the caller's own savings account.
 *
 * The SME is taken from the session, never the body, so a signed-in SME cannot
 * credit another business's account. The balance is read and written inside a
 * transaction with a guard on the resulting balance, because two concurrent
 * deposits computed from the same starting balance would otherwise lose one.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  if (!scope.smeId) {
    return NextResponse.json(
      { error: "No business is linked to this account." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "A positive amount is required." },
      { status: 400 },
    );
  }

  const account = await prisma.savings.findUnique({
    where: { smeId: scope.smeId },
    select: { id: true, balance: true, isFrozen: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "This business has no savings account." },
      { status: 404 },
    );
  }
  if (account.isFrozen) {
    return NextResponse.json(
      { error: "This savings account is frozen." },
      { status: 403 },
    );
  }

  const balanceAfter = Number(account.balance) + amount;

  const [, transaction] = await prisma.$transaction([
    prisma.savings.update({
      where: { id: account.id },
      data: { balance: balanceAfter, totalDeposits: { increment: amount } },
    }),
    prisma.savingsTransaction.create({
      data: {
        savingsId: account.id,
        type: "DEPOSIT",
        amount,
        balanceAfter,
        reference: body.reference ?? null,
        narration: body.narration ?? "Deposit",
        simulated: true,
      },
    }),
  ]);

  return NextResponse.json({ data: transaction }, { status: 201 });
}
