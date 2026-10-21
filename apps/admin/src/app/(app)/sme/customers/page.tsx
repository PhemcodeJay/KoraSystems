"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, Empty, Table, Td, Th } from "@/components/ui";

type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  town: string | null;
  county: string | null;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  _count?: { sales: number };
};

const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);

/**
 * Customers who have bought from this business.
 *
 * The route answers with a bare array and is already tenant-scoped server-side
 * (an SME sees only customers with a sale of its own), so nothing is filtered
 * here — filtering again in the client would be redundant and could disagree
 * with the server's scope.
 */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadList(api.customers.path)
      .then((d) => setCustomers(d))
      .finally(() => setLoaded(true));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.fullName} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {customers.length} who have bought from you
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="w-64 rounded-lg border border-ink-300 px-3 py-2 text-sm"
          aria-label="Search customers"
        />
      </div>

      <Card>
        {visible.length === 0 ? (
          <Empty
            message={
              loaded
                ? "No customers yet — they appear after their first purchase."
                : "Loading…"
            }
          />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Customer</Th>
                <Th>Contact</Th>
                <Th>Location</Th>
                <Th className="text-right">Purchases</Th>
                <Th className="text-right">Points</Th>
                <Th>Tier</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium text-ink-900">{c.fullName}</Td>
                  <Td className="text-xs">
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div className="text-ink-500">{c.email}</div>}
                    {!c.phone && !c.email && "—"}
                  </Td>
                  <Td className="text-sm text-ink-600">
                    {[c.town, c.county].filter(Boolean).join(", ") || "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{c._count?.sales ?? 0}</Td>
                  <Td className="text-right tabular-nums">
                    {Number(c.loyaltyPoints ?? 0).toLocaleString()}
                  </Td>
                  <Td className="text-xs">{c.loyaltyTier ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
