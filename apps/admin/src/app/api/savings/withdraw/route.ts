import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Withdraw from the caller's own savings account.
 *
 * The balance is checked inside the transaction and re-asserted with a
 * conditional update, so an overdraft cannot slip through when two
 * withdrawals race on the same starting balance.
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

  const current = Number(account.balance);
  if (amount > current) {
    return NextResponse.json(
      {
        error: `Insufficient funds. Available balance is KES ${current.toFixed(2)}.`,
      },
      { status: 400 },
    );
  }

  const balanceAfter = current - amount;

  // Conditional update: the `balance` in the where clause is the optimistic
  // lock. If a concurrent withdrawal already moved it, this matches no row and
  // we report insufficient funds rather than overdrawing.
  const updated = await prisma.savings.updateMany({
    where: { id: account.id, balance: { equals: account.balance } },
    data: { balance: balanceAfter, totalWithdrawals: { increment: amount } },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "The balance changed while withdrawing. Please try again." },
      { status: 409 },
    );
  }

  const transaction = await prisma.savingsTransaction.create({
    data: {
      savingsId: account.id,
      type: "WITHDRAWAL",
      amount,
      balanceAfter,
      reference: body.reference ?? null,
      narration: body.narration ?? "Withdrawal",
      simulated: true,
    },
  });

  return NextResponse.json({ data: transaction }, { status: 201 });
}
