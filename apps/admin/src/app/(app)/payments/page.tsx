"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError } from "@/lib/client";
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
  metadata?: { status?: string } | null;
};

type Balance = { accountCode: string; debit: number; credit: number; balance: number };

type C2bCandidate = {
  id: string;
  reference: string;
  soldAt: string;
  amount: string | number;
};

type C2bEvent = {
  id: string;
  reference: string;
  amount: string | number;
  postedAt: string;
  businessName: string | null;
  billReference: string | null;
  candidates: C2bCandidate[];
};

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
  const [c2bEvents, setC2bEvents] = useState<C2bEvent[]>([]);
  const [c2bSelections, setC2bSelections] = useState<Record<string, string>>({});
  const [c2bLoading, setC2bLoading] = useState(true);
  const [c2bError, setC2bError] = useState("");
  const [reconciling, setReconciling] = useState("");

  useEffect(() => {
    Promise.all([
      loadList(api.ledgerTransactions.path).then((d) => setTxns(d as Txn[])),
      loadBalances(api.ledgerBalance.path).then(setBalances),
    ]).finally(() => setLoading(false));

    fetch(api.mpesaC2bReconciliation.path, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response, "Could not load C2B payments."));
        }
        const payload = await response.json();
        setC2bEvents(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch((error: unknown) => {
        setC2bError(error instanceof Error ? error.message : "Could not load C2B payments.");
      })
      .finally(() => setC2bLoading(false));
  }, []);

  async function reconcileC2b(event: C2bEvent) {
    const saleId = c2bSelections[event.reference];
    if (!saleId) return;

    setReconciling(event.reference);
    setC2bError("");
    try {
      const response = await apiFetch(api.mpesaC2bReconciliation.path, {
        method: "POST",
        body: { reference: event.reference, saleId },
      });
      const payload = await response.json();
      setC2bEvents((current) => current.filter((item) => item.id !== event.id));
      setTxns((current) =>
        current.map((txn) =>
          txn.reference === event.reference
            ? { ...txn, metadata: { ...txn.metadata, status: "RECONCILED" } }
            : txn,
        ),
      );
      setC2bSelections((current) => {
        const next = { ...current };
        delete next[event.reference];
        return next;
      });
      void payload;
    } catch (error) {
      setC2bError(
        error instanceof Error ? error.message : "Could not reconcile that payment.",
      );
    } finally {
      setReconciling("");
    }
  }

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
        <Stat label="Transactions" value={String(txns.length)} />
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

      <Card
        title="C2B payments to reconcile"
        hint="Link a callback to a completed M-Pesa sale for the exact amount. This records the receipt on the existing sale without posting a second ledger entry."
      >
        {c2bError && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {c2bError}
          </p>
        )}
        {c2bEvents.length === 0 ? (
          <Empty message={c2bLoading ? "Loading C2B payments…" : "No C2B payments need reconciliation."} />
        ) : (
          <div className="space-y-3">
            {c2bEvents.map((event) => {
              const saleId = c2bSelections[event.reference] ?? "";
              return (
                <div key={event.id} className="grid gap-3 rounded-lg border border-ink-200 p-4 md:grid-cols-[1fr_1.5fr_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-700">{event.reference}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">{fmtKES(Number(event.amount))}</p>
                    <p className="text-xs text-ink-500">
                      {event.businessName ? `${event.businessName} · ` : ""}
                      {event.billReference ? `Bill ref: ${event.billReference} · ` : ""}
                      {fmtDateTime(event.postedAt)}
                    </p>
                  </div>
                  <label className="text-xs text-ink-600">
                    Matching M-Pesa sale
                    <select
                      value={saleId}
                      onChange={(e) =>
                        setC2bSelections((current) => ({
                          ...current,
                          [event.reference]: e.target.value,
                        }))
                      }
                      className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900"
                      disabled={event.candidates.length === 0 || reconciling === event.reference}
                    >
                      <option value="">Select an exact-amount sale</option>
                      {event.candidates.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.reference} · {fmtKES(Number(sale.amount))} · {fmtDateTime(sale.soldAt)}
                        </option>
                      ))}
                    </select>
                    {event.candidates.length === 0 && (
                      <span className="mt-1 block text-amber-700">
                        No unreceipted, completed M-Pesa sale matches this amount.
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => void reconcileC2b(event)}
                    disabled={!saleId || reconciling === event.reference}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reconciling === event.reference ? "Reconciling…" : "Reconcile"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Recent transactions"
        hint="Unreconciled C2B callbacks are excluded from ledger balances. Reconciliation attaches a receipt to an existing sale and does not post a duplicate."
      >
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
                    {t.metadata?.status === "RECEIVED_UNRECONCILED" && (
                      <span className="ml-1 text-xs font-medium text-amber-700">
                        awaiting reconciliation
                      </span>
                    )}
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
