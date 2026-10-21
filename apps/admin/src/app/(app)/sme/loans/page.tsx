"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, LOAN_STYLES, Table, Td, Th, humanise } from "@/components/ui";

type Loan = {
  id: string;
  loanNumber: string;
  principal: string | number;
  totalPayable: string | number;
  amountRepaid: string | number;
  status: string;
  createdAt: string;
};

const loadWrapped = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as any[]);

/**
 * Loans and credit applications.
 *
 * Applying records intent only. Disbursement stays behind the fail-closed gate
 * in @kora/disbursement, so nothing here moves money — an approved loan is
 * parked until a CBK-licensed partner is configured.
 */
export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    loadWrapped(api.loans.path).then((d) => setLoans(d as Loan[]));

  useEffect(() => {
    load();
  }, []);

  async function apply() {
    const principal = Number(amount);
    if (!Number.isFinite(principal) || principal <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(api.loanApply.path, {
        method: "POST",
        body: { principal, purpose },
      });
      if (!response.ok) {
        setError(await readError(response, "Could not submit the application."));
        return;
      }
      setAmount("");
      setPurpose("");
      await load();
    } catch {
      setError("Could not submit the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Loans</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Apply for working capital. Disbursement waits for a licensed partner.
        </p>
      </div>

      <Card title="Apply for a loan">
        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="Amount (KES)"
            className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
            aria-label="Loan amount"
          />
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose"
            className="min-w-48 flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm"
            aria-label="Loan purpose"
          />
          <button
            onClick={apply}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </Card>

      <Card title="Your loans">
        {loans.length === 0 ? (
          <Empty message="No loan applications yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Loan</Th>
                <Th>Status</Th>
                <Th className="text-right">Principal</Th>
                <Th className="text-right">Repaid</Th>
                <Th className="text-right">Payable</Th>
                <Th>Applied</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loans.map((l) => (
                <tr key={l.id}>
                  <Td className="font-medium text-ink-900">{l.loanNumber}</Td>
                  <Td>
                    <Badge className={LOAN_STYLES[l.status]}>{humanise(l.status)}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.principal)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.amountRepaid)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.totalPayable)}</Td>
                  <Td className="text-xs">{fmtDate(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
