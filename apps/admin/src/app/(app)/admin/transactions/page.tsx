"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchList } from "@/lib/client";
import { fmtDateTime, fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

type Txn = {
  id: string;
  reference: string;
  type: string;
  accountCode: string;
  description: string | null;
  amount: string | number;
  postedAt: string;
  simulated?: boolean;
};

/**
 * Every ledger posting, platform-wide.
 *
 * /api/ledger/transactions answers with a bare array (ADMIN sees all, an SME
 * its own — tenant scoping is the route's job), so the read goes through
 * fetchList. Each row links through to the reference detail page, which shows
 * the double-entry legs and whether they balance.
 */
export default function AdminTransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList<Txn>("/api/ledger/transactions")
      .then(setTxns)
      .finally(() => setLoading(false));
  }, []);

  const types = useMemo(
    () => ["ALL", ...Array.from(new Set(txns.map((t) => t.type)))].sort(),
    [txns],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (type !== "ALL" && t.type !== type) return false;
      if (!q) return true;
      return [t.reference, t.accountCode, t.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [txns, query, type]);

  const total = filtered.reduce((s, t) => s + Number(t.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Ledger</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {filtered.length} postings · {fmtKES(total)} moved
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference, account or description…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by transaction type"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "All types" : t}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <Empty message="Loading postings…" />
        ) : filtered.length === 0 ? (
          <Empty message="No postings match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Ref</Th>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th>Account</Th>
                <Th>Description</Th>
                <Th className="text-right">Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-ink-50">
                  <Td className="font-mono text-xs">
                    <Link
                      href={"/admin/transactions/" + t.reference}
                      className="text-brand-700 hover:underline"
                    >
                      {t.reference}
                    </Link>
                  </Td>
                  <Td>
                    <Badge>{humanise(t.type)}</Badge>
                    {t.simulated && (
                      <span className="ml-1 text-xs text-ink-400">simulated</span>
                    )}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(t.amount)}
                  </Td>
                  <Td className="font-mono text-xs">{t.accountCode}</Td>
                  <Td className="text-sm text-ink-600">{t.description ?? "—"}</Td>
                  <Td className="text-right text-xs">
                    {fmtDateTime(t.postedAt)}
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
