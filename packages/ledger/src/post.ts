import {
  DIRECTION,
  UnbalancedPostingError,
  type LedgerLeg,
  type PostingInput,
} from "./types";
import type { LedgerDb } from "./balance";

/** Round to 2dp to avoid float drift making a balanced posting look unbalanced. */
export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumLegs(legs: LedgerLeg[]): { debits: number; credits: number } {
  let debits = 0;
  let credits = 0;
  for (const leg of legs) {
    const amt = money(leg.amount);
    if (amt <= 0) {
      throw new Error(`Ledger leg amount must be positive, got ${leg.amount}`);
    }
    if (leg.direction === DIRECTION.DEBIT) debits += amt;
    else credits += amt;
  }
  return { debits: money(debits), credits: money(credits) };
}

/**
 * Throws unless debits === credits. This is the invariant that stops admin
 * reports double counting: every movement is posted as a balanced set of
 * legs, and reports read the ledger rather than summing domain tables.
 */
export function assertBalanced(reference: string, legs: LedgerLeg[]): void {
  const { debits, credits } = sumLegs(legs);
  if (Math.abs(debits - credits) > 0.001) {
    throw new UnbalancedPostingError(reference, debits, credits);
  }
}

export type PostResult = {
  transactionId: string;
  reference: string;
  debits: number;
  credits: number;
};

/**
 * Persist a balanced posting: one Transaction header plus its LedgerEntry legs.
 * Pass an interactive-transaction client to run inside an existing tx.
 */
export async function post(
  input: PostingInput,
  legs: LedgerLeg[],
  db: LedgerDb,
): Promise<PostResult> {
  assertBalanced(input.reference, legs);
  const { debits, credits } = sumLegs(legs);

  // `reference` is the idempotency key, so the same posting sent twice must
  // land once. Without this the demo seed re-posting its own rows throws
  // P2002 against headers it wrote itself — and a caller retrying a request
  // that already committed would fail the second time. Return what is already
  // there instead of double-writing the legs or erroring.
  const existing = await db.transaction.findUnique({
    where: { reference: input.reference },
    select: { id: true, reference: true },
  });
  if (existing) {
    return { transactionId: existing.id, reference: existing.reference, debits, credits };
  }

  const header = await db.transaction.create({
    data: {
      reference: input.reference,
      type: input.type,
      description: input.description,
      accountCode: input.accountCode,
      amount: money(input.amount),
      currency: "KES",
      smeId: input.smeId ?? null,
      customerId: input.customerId ?? null,
      simulated: input.simulated ?? false,
      metadata: (input.metadata ?? undefined) as never,
      loanId: input.loanId ?? null,
      repaymentId: input.repaymentId ?? null,
      bnplInstallmentId: input.bnplInstallmentId ?? null,
      postedAt: input.postedAt ?? new Date(),
      entries: {
        create: legs.map((leg) => ({
          accountCode: leg.accountCode,
          direction: leg.direction,
          amount: money(leg.amount),
          narration: leg.narration,
        })),
      },
    },
    select: { id: true, reference: true },
  });

  return { transactionId: header.id, reference: header.reference, debits, credits };
}
