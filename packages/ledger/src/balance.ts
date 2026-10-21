import { DIRECTION, type AccountCode } from "./types";
import { money } from "./post";

/**
 * Minimal structural view of the Prisma client the ledger needs.
 *
 * Declared here rather than importing @kora/database so the dependency runs
 * one way: apps -> ledger -> (caller supplies the client). Importing the
 * client directly would make ledger <-> database a workspace cycle.
 */
export type LedgerDb = {
  ledgerEntry: {
    findMany(args: unknown): Promise<
      Array<{ accountCode: string; direction: string; amount: unknown }>
    >;
  };
  transaction: {
    create(args: unknown): Promise<{ id: string; reference: string }>;
    // Idempotency check in `post()`: `reference` is unique, so a re-post of a
    // committed reference must resolve to the header that already exists.
    findUnique(
      args: unknown,
    ): Promise<{ id: string; reference: string } | null>;
  };
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type AccountBalance = {
  accountCode: AccountCode;
  debit: number;
  credit: number;
  balance: number;
};

/**
 * Aggregate balances per account from ledger entries.
 *
 * Reports should read this rather than summing Sale/Loan/Savings tables,
 * because each of those can already be represented in the ledger; summing
 * both would double count.
 */
export async function accountBalances(
  db: LedgerDb,
  filter: { smeId?: string; from?: Date; to?: Date } = {},
): Promise<AccountBalance[]> {
  const rows = await db.ledgerEntry.findMany({
    where: {
      transaction: {
        smeId: filter.smeId ?? undefined,
        postedAt: { gte: filter.from, lte: filter.to },
      },
    },
    select: { accountCode: true, direction: true, amount: true },
  });

  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const r of rows) {
    const cur = byAccount.get(r.accountCode) ?? { debit: 0, credit: 0 };
    const amt = Number(r.amount);
    if (r.direction === DIRECTION.DEBIT) cur.debit += amt;
    else cur.credit += amt;
    byAccount.set(r.accountCode, cur);
  }

  return [...byAccount.entries()].map(([accountCode, v]) => ({
    accountCode: accountCode as AccountCode,
    debit: money(v.debit),
    credit: money(v.credit),
    balance: money(v.debit - v.credit),
  }));
}

/**
 * Audit helper: return any transaction whose legs do not balance.
 * Expected to return an empty array; used by tests and the seed self-check.
 */
export async function findUnbalanced(
  db: LedgerDb,
  limit = 50,
): Promise<
  Array<{
    reference: string;
    debits: number;
    credits: number;
    diff: number;
  }>
> {
  const rows = await db.$queryRaw<
    Array<{ reference: string; debits: string; credits: string }>
  >`
    SELECT
      t.reference,
      COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'DEBIT'), 0)  AS debits,
      COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'CREDIT'), 0) AS credits
    FROM kora.transactions t
    JOIN kora.ledger_entries e ON e.transaction_id = t.id
    GROUP BY t.id, t.reference
    HAVING COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'DEBIT'), 0)
         <> COALESCE(SUM(e.amount) FILTER (WHERE e.direction = 'CREDIT'), 0)
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    reference: r.reference,
    debits: money(Number(r.debits)),
    credits: money(Number(r.credits)),
    diff: money(Number(r.debits) - Number(r.credits)),
  }));
}
