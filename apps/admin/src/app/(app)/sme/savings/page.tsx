"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError } from "@/lib/client";
import { fmtKES, fmtDateTime } from "@/lib/queries";
import { Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

type Savings = {
  id: string;
  accountNumber: string;
  balance: string | number;
  totalDeposits: string | number;
  totalWithdrawals: string | number;
};

type Txn = {
  id: string;
  type: string;
  amount: string | number;
  balanceAfter: string | number;
  narration: string;
  createdAt: string;
};

const loadOne = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.data ?? null)
    .catch(() => null);

const loadTxns = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as Txn[]);

/**
 * Savings.
 *
 * The route answers { data: <account|null> }. Storing the wrapper made balance
 * undefined and rendered "KES NaN", so the unwrap is explicit here.
 */
export default function SavingsPage() {
  const [account, setAccount] = useState<Savings | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [a, t] = await Promise.all([
      loadOne(api.savings.path),
      loadTxns(api.savingsTxns.path),
    ]);
    setAccount(a);
    setTxns(t);
  };

  useEffect(() => {
    load();
  }, []);

  async function move(kind: "deposit" | "withdraw") {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        kind === "deposit" ? api.savingsDeposit.path : api.savingsWithdraw.path,
        { method: "POST", body: { amount: value } },
      );
      if (!response.ok) {
        setError(await readError(response, "The savings account rejected that request."));
        return;
      }
      setAmount("");
      await load();
    } catch {
      setError("The savings account rejected that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-900">Savings</h1>

      {account ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Balance" value={fmtKES(account.balance)} tone="brand" />
          <Stat label="Deposits" value={fmtKES(account.totalDeposits)} />
          <Stat label="Withdrawals" value={fmtKES(account.totalWithdrawals)} />
          <Stat label="Account" value={account.accountNumber} />
        </div>
      ) : (
        <Card>
          <Empty message="This business has no savings account yet. Open one from Setup." />
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {account && (
        <Card title="Deposit or withdraw">
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder="Amount"
              className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
              aria-label="Amount"
            />
            <button
              onClick={() => move("deposit")}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Deposit
            </button>
            <button
              onClick={() => move("withdraw")}
              disabled={busy}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
        </Card>
      )}

      <Card title="Movements">
        {txns.length === 0 ? (
          <Empty message="No movements yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance</Th>
                <Th>Narration</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txns.map((t) => (
                <tr key={t.id}>
                  <Td className="text-sm">{humanise(t.type)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(t.amount)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(t.balanceAfter)}</Td>
                  <Td className="text-xs text-ink-600">{t.narration}</Td>
                  <Td className="text-xs">{fmtDateTime(t.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
