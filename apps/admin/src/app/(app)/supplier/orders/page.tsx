"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, routePath, readError } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Table, Td, Th, humanise } from "@/components/ui";

type Order = {
  id: string;
  orderNumber: string;
  totalAmount: string | number;
  status: string;
  placedAt: string;
  sme?: { businessName: string; town: string | null } | null;
};

const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);

const ORDER_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  CONFIRMED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SHIPPED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/**
 * Purchase orders, with the confirm/ship/deliver lifecycle.
 *
 * A supplier sees only orders placed against it, and the route re-checks
 * ownership on every transition, so a status cannot be advanced on someone
 * else's order by guessing an id.
 */
export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => loadList(api.orders.path).then((d) => setOrders(d as Order[]));

  useEffect(() => {
    load();
  }, []);

  async function advance(order: Order) {
    const template =
      order.status === "PENDING"
        ? api.orderConfirm.path
        : order.status === "CONFIRMED"
          ? api.orderShip.path
          : order.status === "SHIPPED"
            ? api.orderDeliver.path
            : null;
    if (!template) return;

    setBusy(order.id);
    setError("");
    try {
      const response = await apiFetch(routePath(template, order.id), { method: "POST" });
      if (!response.ok) {
        setError(await readError(response, "Could not update that order."));
        return;
      }
      await load();
    } catch {
      setError("Could not update that order.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Orders</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Confirm, ship and deliver. {orders.length} order{orders.length === 1 ? "" : "s"}.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card>
        {orders.length === 0 ? (
          <Empty message="No orders yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Order</Th>
                <Th>Buyer</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>Placed</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-ink-900">{o.orderNumber}</Td>
                  <Td className="text-sm">
                    {o.sme?.businessName ?? "—"}
                    {o.sme?.town && (
                      <span className="block text-xs text-ink-500">{o.sme.town}</span>
                    )}
                  </Td>
                  <Td>
                    <Badge className={ORDER_STYLES[o.status]}>{humanise(o.status)}</Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(o.totalAmount)}
                  </Td>
                  <Td className="text-xs">{fmtDate(o.placedAt)}</Td>
                  <Td>
                    {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                      <button
                        onClick={() => advance(o)}
                        disabled={busy === o.id}
                        className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {busy === o.id
                          ? "Saving…"
                          : o.status === "PENDING"
                            ? "Confirm"
                            : o.status === "CONFIRMED"
                              ? "Ship"
                              : "Deliver"}
                      </button>
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
