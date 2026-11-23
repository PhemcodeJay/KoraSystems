"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchList } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th } from "@/components/ui";

type Supplier = {
  id: string;
  companyName: string;
  rating: number | null;
  ratingCount: number;
  county: string | null;
  town: string | null;
  contactPhone: string | null;
  createdAt: string;
  user?: { email: string; fullName: string; isActive: boolean } | null;
  _count?: { products: number; orders: number };
};

/**
 * Every supplier on the platform — ADMIN view.
 *
 * Reads /api/suppliers which returns all suppliers when called by ADMIN.
 */
export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await fetchList<Supplier>(api.suppliers.path);
      setSuppliers(data);
    } catch {
      setMessage("Could not load suppliers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    let activeUsers = 0;
    let totalProducts = 0;
    let totalOrders = 0;
    for (const s of suppliers) {
      if (s.user?.isActive) activeUsers++;
      totalProducts += s._count?.products ?? 0;
      totalOrders += s._count?.orders ?? 0;
    }
    return { activeUsers, totalProducts, totalOrders };
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.companyName, s.county, s.town, s.contactPhone, s.user?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [suppliers, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Suppliers</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Manage every vendor on the platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Suppliers" value={String(suppliers.length)} />
        <Stat label="Active accounts" value={String(stats.activeUsers)} tone="brand" />
        <Stat label="Products listed" value={String(stats.totalProducts)} />
        <Stat label="Orders placed" value={String(stats.totalOrders)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company, county, phone or email…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
      </div>

      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      )}

      <Card>
        {loading ? (
          <Empty message="Loading suppliers…" />
        ) : filtered.length === 0 ? (
          <Empty message="No suppliers match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Company</Th>
                <Th>Contact</Th>
                <Th>Location</Th>
                <Th className="text-right">Rating</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Orders</Th>
                <Th className="text-right">Joined</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <Td>
                    <p className="font-medium text-ink-900">{s.companyName}</p>
                    <p className="text-xs text-ink-500">{s.user?.email ?? "—"}</p>
                  </Td>
                  <Td className="text-sm">
                    {s.user?.fullName ?? "—"}
                    {s.contactPhone ? " · " + s.contactPhone : ""}
                  </Td>
                  <Td className="text-sm">
                    {s.county ?? "—"}
                    {s.town ? " · " + s.town : ""}
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    {s.rating?.toFixed(1) ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    {s._count?.products ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums text-sm">
                    {s._count?.orders ?? 0}
                  </Td>
                  <Td className="text-right text-xs text-ink-500">
                    {new Date(s.createdAt).toLocaleDateString("en-KE")}
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
