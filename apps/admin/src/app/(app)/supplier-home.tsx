import Link from "next/link";
import { requireSupplier } from "@kora/auth/guards";
import { getSupplierOverview, fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

const ORDER_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  CONFIRMED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SHIPPED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const ACTIONS = [
  { href: "/supplier/orders", label: "Manage orders", hint: "Confirm, ship, deliver" },
  { href: "/supplier/invoices", label: "Invoices", hint: "Billing and payments" },
  { href: "/payments", label: "Payouts", hint: "Money received and due" },
];

/** The supplier landing page, scoped to the signed-in supplier. */
export async function SupplierHome() {
  const { supplier } = await requireSupplier();
  const d = await getSupplierOverview(supplier.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{supplier.companyName}</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Supplier · rating {supplier.rating?.toFixed?.(1) ?? "—"} ·{" "}
          {d.products.length} products supplied
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open orders" value={String(d.pendingOrders)} tone="brand" />
        <Stat
          label="Order value"
          value={fmtKES(d.pendingValue)}
          hint="Pending and confirmed"
        />
        <Stat label="Paid to date" value={fmtKES(d.revenuePaid)} />
        <Stat
          label="Products"
          value={String(d.products.length)}
          hint="Active in the catalogue"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
          >
            <p className="text-sm font-semibold text-ink-900">{a.label}</p>
            <p className="mt-0.5 text-xs text-ink-500">{a.hint}</p>
          </Link>
        ))}
      </div>

      <Card title="Incoming orders" hint="Businesses buying from you">
        {d.orders.length === 0 ? (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-ink-900">{o.orderNumber}</Td>
                  <Td className="text-sm">
                    {o.sme?.businessName ?? "—"}
                    {o.sme?.town ? (
                      <span className="block text-xs text-ink-500">{o.sme.town}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge className={ORDER_STYLES[o.status] ?? undefined}>
                      {humanise(o.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(o.totalAmount)}
                  </Td>
                  <Td className="text-xs">{fmtDate(o.placedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}