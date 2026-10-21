"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, Empty, Table, Td, Th } from "@/components/ui";

type Supplier = {
  id: string;
  companyName: string;
  town: string | null;
  county: string | null;
  contactPhone: string | null;
  rating: string | number;
  _count?: { products: number; orders: number };
};

const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);

/**
 * Suppliers this business has a relationship with.
 *
 * The route scopes server-side to suppliers reachable through this SME's own
 * products or purchase orders, so an SME never sees every vendor on the
 * platform — only its own counterparties.
 */
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadList(api.suppliers.path)
      .then((d) => setSuppliers(d))
      .finally(() => setLoaded(true));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      `${s.companyName} ${s.town ?? ""}`.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Suppliers</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {suppliers.length} you buy from or supply
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-64 rounded-lg border border-ink-300 px-3 py-2 text-sm"
          aria-label="Search suppliers"
        />
      </div>

      <Card>
        {visible.length === 0 ? (
          <Empty message={loaded ? "No suppliers yet." : "Loading…"} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Supplier</Th>
                <Th>Location</Th>
                <Th>Phone</Th>
                <Th className="text-right">Rating</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Orders</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-ink-900">{s.companyName}</Td>
                  <Td className="text-sm text-ink-600">
                    {[s.town, s.county].filter(Boolean).join(", ") || "—"}
                  </Td>
                  <Td className="text-xs">{s.contactPhone ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {Number(s.rating ?? 0).toFixed(1)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.products ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.orders ?? 0}
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
