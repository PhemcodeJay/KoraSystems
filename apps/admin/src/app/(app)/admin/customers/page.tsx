"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchList } from "@/lib/client";
import { Badge, Card, Empty, Stat, Table, Td, Th } from "@/components/ui";

type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  county: string | null;
  town: string | null;
  loyaltyPoints: number;
  loyaltyTier: string;
  createdAt: string;
  user?: { email: string; fullName: string; isActive: boolean } | null;
  _count?: { sales: number; bnplPlans: number };
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchList<Customer>(api.customers.path);
      setCustomers(data);
    } catch {
      setMessage("Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    let activeUsers = 0;
    let totalSales = 0;
    for (const c of customers) {
      if (c.user?.isActive) activeUsers++;
      totalSales += c._count?.sales ?? 0;
    }
    return { activeUsers, totalSales };
  }, [customers]);

  const tiers = useMemo(
    () => [...new Set(customers.map((c) => c.loyaltyTier))].sort(),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (tierFilter && c.loyaltyTier !== tierFilter) return false;
      if (!q) return true;
      return [c.fullName, c.email, c.phone, c.county, c.town, c.user?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [customers, query, tierFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Manage every shopper on the platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Active accounts" value={String(stats.activeUsers)} tone="brand" />
        <Stat label="Total sales" value={String(stats.totalSales)} />
        <Stat label="Loyalty members" value={String(customers.filter((c) => c.loyaltyPoints > 0).length)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, phone or county…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by loyalty tier"
        >
          <option value="">All tiers</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ").toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      )}

      <Card>
        {loading ? (
          <Empty message="Loading customers…" />
        ) : filtered.length === 0 ? (
          <Empty message="No customers match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Customer</Th>
                <Th>Contact</Th>
                <Th>Location</Th>
                <Th className="text-right">Tier</Th>
                <Th className="text-right">Points</Th>
                <Th className="text-right">Sales</Th>
                <Th className="text-right">Joined</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50">
                  <Td>
                    <p className="font-medium text-ink-900">{c.fullName}</p>
                    <p className="text-xs text-ink-500">{c.email}</p>
                  </Td>
                  <Td className="text-sm">
                    {c.user?.fullName ?? "—"}
                    {c.phone ? " · " + c.phone : ""}
                  </Td>
                  <Td className="text-sm">
                    {c.county ?? "—"}
                    {c.town ? " · " + c.town : ""}
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    <Badge
                      className={
                        c.loyaltyTier === "GOLD"
                          ? "bg-amber-50 text-amber-800 ring-amber-600/20"
                          : c.loyaltyTier === "SILVER"
                            ? "bg-slate-100 text-slate-600 ring-slate-500/20"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                      }
                    >
                      {c.loyaltyTier.replace(/_/g, " ")}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    {c.loyaltyPoints.toLocaleString()}
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    {c._count?.sales ?? 0}
                  </Td>
                  <Td className="text-right text-xs text-ink-500">
                    {new Date(c.createdAt).toLocaleDateString("en-KE")}
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
