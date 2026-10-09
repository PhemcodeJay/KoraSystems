"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtKES, fmtDateTime } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

type Txn = {
  id: string;
  reference: string;
  type: string;
  description: string | null;
  amount: string | number;
  postedAt: string;
  simulated: boolean;
};

type Balance = { accountCode: string; debit: number; credit: number; balance: number };

const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);

const loadBalances = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as Balance[]);

/**
 * Payments and the ledger.
 *
 * One page for every role that moves money, replacing the separate Neobank and
 * SwiftPOS dashboards. Amounts come from ledger postings rather than by summing
 * Sale/Loan/Savings rows, because those are already represented in the ledger
 * and summing both would double count.
 *
 * Postings flagged `simulated` recorded no real money movement. That is the
 * expected state while no licensed disbursement partner is configured.
 */
export default function PaymentsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadList(api.ledgerTransactions.path).then((d) => setTxns(d as Txn[])),
      loadBalances(api.ledgerBalance.path).then(setBalances),
    ]).finally(() => setLoading(false));
  }, []);

  const totals = balances.reduce(
    (acc, b) => ({
      debits: acc.debits + Number(b.debit ?? 0),
      credits: acc.credits + Number(b.credit ?? 0),
    }),
    { debits: 0, credits: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Payments</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          M-Pesa, wallet and ledger activity. Every posting balances.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Postings" value={String(txns.length)} />
        <Stat label="Total debits" value={fmtKES(totals.debits)} />
        <Stat label="Total credits" value={fmtKES(totals.credits)} tone="brand" />
      </div>

      <Card
        title="Account balances"
        hint="Read from ledger entries, not from summing domain tables"
      >
        {balances.length === 0 ? (
          <Empty message={loading ? "Loading…" : "No postings yet."} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Account</Th>
                <Th className="text-right">Debits</Th>
                <Th className="text-right">Credits</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {balances.map((b) => (
                <tr key={b.accountCode}>
                  <Td className="font-mono text-xs">{b.accountCode}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(b.debit)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(b.credit)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(b.balance)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Recent postings">
        {txns.length === 0 ? (
          <Empty message={loading ? "Loading…" : "No postings yet."} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Reference</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>When</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txns.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.reference}</Td>
                  <Td>
                    <Badge>{humanise(t.type)}</Badge>
                    {t.simulated && (
                      <span className="ml-1 text-xs text-ink-400">simulated</span>
                    )}
                  </Td>
                  <Td className="text-sm text-ink-600">{t.description ?? "—"}</Td>
                  <Td className="text-xs">{fmtDateTime(t.postedAt)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(t.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
