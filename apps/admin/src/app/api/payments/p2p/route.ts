import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth/guards";
import { NextResponse } from "next/server";

/**
 * Pay another account on the platform — business to business, or SME to
 * customer.
 *
 * ── Why this is separate from `/api/banking/transfer` ───────────────────────
 * That route only moves money between the caller's OWN accounts: it resolves
 * the destination with `where: { userId: auth.user.id }`, so it is really
 * "move between my wallets", not a payment. Settling with a supplier or
 * collecting from a customer was impossible, which is the common case for an
 * SME on this platform.
 *
 * This resolves the destination by account number across the whole platform,
 * and refuses to pay the caller's own account so it cannot be used to
 * manufacture transaction history.
 *
 * Both balances move in one transaction: a debit that lands without its
 * matching credit, or vice versa, is unrecoverable money.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "SUPPLIER", "CUSTOMER", "ADMIN");
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    fromAccountId?: string;
    toAccountNumber?: string;
    amount?: number | string;
    reference?: string;
  } | null;

  if (!body?.fromAccountId || !body.toAccountNumber) {
    return NextResponse.json(
      { error: "A source account and a destination account number are both required." },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }
  // Guards against a typo sending a whole year's takings in one tap. Rounded to
  // 2dp because the balance column is DECIMAL(14,2) and a longer fraction would
  // be silently truncated by the database.
  const value = Math.round(amount * 100) / 100;

  const from = await prisma.account.findFirst({
    where: { id: body.fromAccountId, userId: auth.user.id },
    select: { id: true, accountName: true, accountNumber: true, balance: true, userId: true },
  });

  if (!from) {
    return NextResponse.json({ error: "Source account not found." }, { status: 404 });
  }

  const to = await prisma.account.findUnique({
    where: { accountNumber: body.toAccountNumber.trim() },
    select: { id: true, accountName: true, accountNumber: true, balance: true, userId: true },
  });

  if (!to) {
    return NextResponse.json({ error: "No account matches that number." }, { status: 404 });
  }

  if (to.id === from.id) {
    return NextResponse.json(
      { error: "That is the account you are paying from." },
      { status: 400 },
    );
  }

  const fromBalance = Number(from.balance);
  if (fromBalance < value) {
    return NextResponse.json(
      {
        error: "Not enough in the source account.",
        available: fromBalance,
        required: value,
      },
      { status: 400 },
    );
  }

  const reference = `P2P-${Date.now()}-${auth.user.id.slice(-4)}`;

  let fromAfter: { balance: { toString(): string } };
  let toAfter: { balance: { toString(): string } };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Decremented with a `gte` guard so two concurrent payments cannot both
      // read the same balance and each believe they had enough. Postgres applies
      // this as a conditional UPDATE, so exactly one of them succeeds.
      const debited = await tx.account.updateMany({
        where: { id: from.id, balance: { gte: value } },
        data: { balance: { decrement: value } },
      });
      if (debited.count === 0) throw new InsufficientFunds();

      const credited = await tx.account.update({
        where: { id: to.id },
        data: { balance: { increment: value } },
      });

      await tx.transaction.create({
        data: {
          reference,
          type: "P2P",
          description:
            body.reference?.trim() ||
            `Payment from ${auth.user.fullName} to ${to.accountName}`,
          accountCode: "TRANSFER",
          amount: value,
          currency: "KES",
          simulated: true,
        },
      });

      const after = await tx.account.findUniqueOrThrow({
        where: { id: from.id },
        select: { balance: true },
      });

      return { after, credited };
    });

    fromAfter = result.after;
    toAfter = result.credited;
  } catch (error) {
    if (error instanceof InsufficientFunds) {
      return NextResponse.json(
        { error: "Not enough in the source account.", available: fromBalance, required: value },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not complete the payment." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reference,
    amount: value,
    currency: "KES",
    from: { accountNumber: from.accountNumber, balance: fromAfter.balance.toString() },
    to: { accountNumber: to.accountNumber, balance: toAfter.balance.toString() },
  });
}

/** Thrown inside the transaction to force a rollback on a lost race. */
class InsufficientFunds extends Error {
  constructor() {
    super("Insufficient funds");
    this.name = "InsufficientFunds";
  }
}