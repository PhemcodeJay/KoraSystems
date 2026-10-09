"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiFetch, ApiError, fetchWrappedList, routePath } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, LOAN_STYLES, Stat, Table, Td, Th } from "@/components/ui";

type Loan = {
  id: string;
  loanNumber: string;
  principal: string | number;
  maxApprovedAmount: string | number | null;
  termMonths: number;
  purpose: string | null;
  status: string;
};

/**
 * The loan review queue.
 *
 * /api/loans answers { data: [...] }, so the read goes through
 * fetchWrappedList. Approve and reject hit the real /api/loans/:id routes
 * (they previously called endpoints that did not exist, so both buttons
 * silently did nothing), failures are shown in the page, and both buttons
 * disable while in flight so a double-click cannot submit twice.
 *
 * Approving records a decision only — disbursement stays behind the
 * fail-closed gate, so no money moves from this screen.
 */
export default function AdminLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    fetchWrappedList<Loan>(api.loans.path)
      .then(setLoans)
      .finally(() => setLoading(false));
  }, []);

  async function decide(loanId: string, action: "approve" | "reject") {
    setBusyId(loanId);
    setError("");
    setNotice("");
    try {
      const template =
        action === "approve" ? api.loanApprove.path : api.loanReject.path;
      await apiFetch(routePath(template, loanId), { method: "POST" });
      setNotice(action === "approve" ? "Loan approved." : "Loan rejected.");
      setLoans(await fetchWrappedList<Loan>(api.loans.path));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not reach the server. Check your connection.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const pending = loans.filter((l) => l.status === "PENDING_REVIEW").length;
  const approvedValue = loans
    .filter((l) => ["APPROVED", "DISBURSED", "REPAYING"].includes(l.status))
    .reduce(
      (sum, l) => sum + Number(l.maxApprovedAmount ?? l.principal ?? 0),
      0,
    );

  const visible = useMemo(() => {
    if (filter === "ALL") return loans;
    if (filter === "PENDING")
      return loans.filter((l) => l.status === "PENDING_REVIEW");
    return loans.filter((l) => l.status === filter);
  }, [loans, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Credit desk</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {pending} awaiting review · {fmtKES(approvedValue)} approved
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting review" value={String(pending)} tone="warning" />
        <Stat label="Approved value" value={fmtKES(approvedValue)} tone="brand" />
        <Stat label="Total applications" value={String(loans.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Filter loans">
          {["PENDING", "ALL", "APPROVED", "REJECTED"].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (filter === f
                  ? "bg-brand-600 text-white"
                  : "border border-ink-200 text-ink-600 hover:bg-ink-50")
              }
            >
              {f === "PENDING" ? "Pending" : f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <Card>
        {loading ? (
          <Empty message="Loading applications…" />
        ) : visible.length === 0 ? (
          <Empty message="No applications in this view." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Loan #</Th>
                <Th className="text-right">Principal</Th>
                <Th className="text-right">Term</Th>
                <Th>Purpose</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((l) => (
                <tr key={l.id} className="hover:bg-ink-50">
                  <Td className="font-mono text-xs">{l.loanNumber}</Td>
                  <Td className="text-right tabular-nums">
                    {fmtKES(l.principal)}
                  </Td>
                  <Td className="text-right tabular-nums">{l.termMonths} mo</Td>
                  <Td className="text-sm">{l.purpose ?? "—"}</Td>
                  <Td>
                    <Badge className={LOAN_STYLES[l.status]}>
                      {humanise(l.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {l.status === "PENDING_REVIEW" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                          disabled={busyId === l.id}
                          onClick={() => decide(l.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                          disabled={busyId === l.id}
                          onClick={() => decide(l.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">—</span>
                    )}
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
