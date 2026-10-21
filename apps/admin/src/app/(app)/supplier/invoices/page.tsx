"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Table, Td, Th, humanise } from "@/components/ui";

type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: string | number;
  amountPaid: string | number;
  status: string;
  dueDate: string | null;
  sme?: { businessName: string } | null;
};

const INVOICE_STYLES: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  SENT: "bg-sky-50 text-sky-700 ring-sky-600/20",
  OVERDUE: "bg-red-50 text-red-700 ring-red-600/20",
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/**
 * Invoices raised against this supplier.
 *
 * The route scopes to the caller's own supplier id server-side, so this shows
 * only what that supplier is owed.
 */
export default function SupplierInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetch(api.invoices.path, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInvoices(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setInvoices([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}.
        </p>
      </div>

      <Card>
        {invoices.length === 0 ? (
          <Empty message="No invoices yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium text-ink-900">{i.invoiceNumber}</Td>
                  <Td className="text-sm">{i.sme?.businessName ?? "—"}</Td>
                  <Td>
                    <Badge className={INVOICE_STYLES[i.status] ?? undefined}>
                      {humanise(i.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtKES(i.totalAmount)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(i.amountPaid)}</Td>
                  <Td className="text-xs">{fmtDate(i.dueDate)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
