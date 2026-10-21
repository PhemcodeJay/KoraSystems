"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchList } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Stat, Table, Td, Th } from "@/components/ui";

type Sme = {
  id: string;
  businessName: string;
  businessType: string | null;
  county: string | null;
  town: string | null;
  onboardingStatus: string;
  subscriptionStatus: string;
  subscriptionAmount: string | number;
  user?: { email: string; fullName: string; isActive: boolean };
  _count?: { sales: number; products: number; loans: number };
};

/**
 * Every business on the platform.
 *
 * /api/smes answers with a bare array (ADMIN-only, platform-wide by nature),
 * so the read goes through fetchList — the old page read `.data` off it and
 * the table stayed empty with no error.
 */
export default function AdminSmesPage() {
  const [smes, setSmes] = useState<Sme[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList<Sme>("/api/smes")
      .then(setSmes)
      .finally(() => setLoading(false));
  }, []);

  const statuses = useMemo(
    () =>
      ["ALL", ...Array.from(new Set(smes.map((s) => s.onboardingStatus)))].sort(),
    [smes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return smes.filter((s) => {
      if (status !== "ALL" && s.onboardingStatus !== status) return false;
      if (!q) return true;
      return [s.businessName, s.county, s.businessType, s.user?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [smes, query, status]);

  const active = smes.filter((s) => s.subscriptionStatus === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Businesses</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {smes.length} on the platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Businesses" value={String(smes.length)} />
        <Stat label="Active subscriptions" value={String(active)} tone="brand" />
        <Stat
          label="Sales recorded"
          value={String(smes.reduce((n, s) => n + (s._count?.sales ?? 0), 0))}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, county or email…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by onboarding status"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <Empty message="Loading businesses…" />
        ) : filtered.length === 0 ? (
          <Empty message="No businesses match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Business</Th>
                <Th>Location</Th>
                <Th>Onboarding</Th>
                <Th>Subscription</Th>
                <Th className="text-right">Sales</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <Td>
                    <p className="font-medium text-ink-900">{s.businessName}</p>
                    <p className="text-xs text-ink-500">{s.user?.email}</p>
                  </Td>
                  <Td className="text-sm">
                    {s.county ?? "—"}
                    {s.town ? " · " + s.town : ""}
                  </Td>
                  <Td>
                    <Badge>{humanise(s.onboardingStatus)}</Badge>
                  </Td>
                  <Td>
                    <Badge
                      className={
                        s.subscriptionStatus === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-800 ring-amber-600/20"
                      }
                    >
                      {humanise(s.subscriptionStatus)}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.sales ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.products ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtKES(s.subscriptionAmount)}
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
