"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError, routePath } from "@/lib/client";
import { fmtDateTime, fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: { name: string } | null;
};

type Sale = {
  id: string;
  totalAmount: string | number;
  paymentMethod: string;
  paymentStatus: string;
  mpesaReceipt: string | null;
  soldAt: string;
  items?: SaleItem[];
};

const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);

/**
 * The business's own completed sales.
 *
 * /api/sales answers with a bare array and is already tenant-scoped
 * server-side, so nothing is filtered again here. Clicking a row expands its
 * line items, where a reversible sale can also be voided.
 *
 * ── Why voiding lives behind an expand + confirm ────────────────────────────
 * A void is not a delete: it flips the sale to REVERSED and puts the stock
 * back, permanently altering revenue history and inventory. Placing the
 * control in the expanded panel makes it a deliberate two-step gesture rather
 * than something a stray click on a data row can trigger, and the confirm
 * states what will happen before any request is sent.
 */
export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    loadList(api.sales.path).then((d) => setSales(d as Sale[]));

  useEffect(() => {
    load();
  }, []);

  const total = sales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);

  async function voidSale(sale: Sale) {
    const units = sale.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
    const confirmed = window.confirm(
      `Void this ${fmtKES(sale.totalAmount)} sale?\n\n` +
        "The sale is marked REVERSED (not deleted) and " +
        `${units} unit${units === 1 ? "" : "s"} go back into stock. ` +
        "Historical revenue is adjusted to exclude it.",
    );
    if (!confirmed) return;

    setBusy(sale.id);
    setError("");
    try {
      const response = await apiFetch(routePath(api.saleVoid.path, sale.id), {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readError(response, "Could not void that sale."));
        return;
      }
      setExpanded(null);
      await load();
    } catch {
      setError("Could not void that sale.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Sales</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {sales.length} {sales.length === 1 ? "sale" : "sales"} · {fmtKES(total)} total
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <Card title="Completed sales" hint="Click a row to see its items">
        {sales.length === 0 ? (
          <Empty message="No sales recorded yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Date</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sales.map((s) => {
                const open = expanded === s.id;
                const units = s.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
                return (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    units={units}
                    open={open}
                    busy={busy === s.id}
                    onToggle={() => setExpanded(open ? null : s.id)}
                    onVoid={() => voidSale(s)}
                  />
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {sales.length > 0 && (
        <p className="text-xs text-ink-400">
          Click a row to see its items and void a reversible sale.
        </p>
      )}
    </div>
  );
}

/**
 * Statuses `DELETE /api/sales/[id]` will still reverse.
 *
 * Mirrored from that route rather than imported, because the server answer is
 * authoritative: if the two ever disagree the button is simply shown for a
 * sale the route then rejects with 409, which surfaces the error instead of
 * corrupting anything.
 */
const REVERSIBLE = ["PENDING", "COMPLETED"];

function SaleRow({
  sale,
  units,
  open,
  busy,
  onToggle,
  onVoid,
}: {
  sale: Sale;
  units: number;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onVoid: () => void;
}) {
  const canVoid = REVERSIBLE.includes(sale.paymentStatus);
  return (
    <>
      <tr className="cursor-pointer hover:bg-ink-50" onClick={onToggle}>
        <Td className="whitespace-nowrap text-xs">
          {fmtDateTime(sale.soldAt)}
        </Td>
        <Td className="text-xs">
          {humanise(sale.paymentMethod)}
          {sale.mpesaReceipt && (
            <span className="block font-mono text-[11px] text-ink-400">
              {sale.mpesaReceipt}
            </span>
          )}
        </Td>
        <Td>
          <Badge
            className={
              sale.paymentStatus === "REVERSED"
                ? "bg-red-50 text-red-700 ring-red-600/20"
                : sale.paymentStatus === "COMPLETED"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  : "bg-amber-50 text-amber-800 ring-amber-600/20"
            }
          >
            {humanise(sale.paymentStatus)}
          </Badge>
        </Td>
        <Td className="text-right tabular-nums">{units}</Td>
        <Td className="text-right font-medium tabular-nums">
          {fmtKES(sale.totalAmount)}
        </Td>
      </tr>
      {open && (
        <tr className="bg-ink-50">
          <td colSpan={5} className="px-3 py-2.5">
            <ul className="space-y-1">
              {(sale.items ?? []).map((i) => (
                <li key={i.id} className="flex justify-between text-xs">
                  <span>
                    {i.product?.name ?? "Product"} × {i.quantity}
                  </span>
                  <span className="tabular-nums">{fmtKES(i.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-2.5">
              <p className="text-[11px] text-ink-500">
                {canVoid
                  ? "Voiding reverses this sale and returns its stock."
                  : `This sale is ${humanise(sale.paymentStatus).toLowerCase()} and can no longer be voided.`}
              </p>
              <button
                onClick={(event) => {
                  // The row's onClick collapses it; without this the void
                  // control would also toggle the panel it lives in.
                  event.stopPropagation();
                  onVoid();
                }}
                disabled={busy || !canVoid}
                className="shrink-0 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Voiding…" : "Void sale"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
