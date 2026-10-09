import { requireSupplier } from "@kora/auth/guards";
import { getSupplierOverview, fmtKES, fmtNum, fmtDate } from "@/lib/queries";
import {
  Badge,
  Card,
  Empty,
  Stat,
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";
import { APPS } from "@kora/brand";
import { ComingSoonNotice } from "./notice";

/** Everything a supplier may see, scoped to their own company. */
export async function SupplierView() {
  const { supplier } = await requireSupplier();
  const d = await getSupplierOverview(supplier.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{supplier.companyName}</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {supplier.town}, {supplier.county} · rated {supplier.rating.toFixed(1)}/5
          from {supplier.ratingCount} reviews
        </p>
      </div>

      <ComingSoonNotice app={APPS.supplier.name} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending orders" value={fmtNum(d.pendingOrders)} tone="warning" />
        <Stat label="Pending value" value={fmtKES(d.pendingValue)} />
        <Stat label="Paid to date" value={fmtKES(d.revenuePaid)} />
        <Stat label="Products" value={fmtNum(d.products.length)} />
      </div>

      <Card title="Recent orders">
        {d.orders.length === 0 ? (
          <Empty message="No orders yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Order</Th>
                <Th>Buyer</Th>
                <Th>Status</Th>
                <Th className="text-right">Value</Th>
                <Th>Placed</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-ink-900">{o.orderNumber}</Td>
                  <Td className="text-sm">
                    {o.sme.businessName}
                    {o.sme.town ? (
                      <div className="text-xs text-ink-500">{o.sme.town}</div>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge className="bg-ink-100 text-ink-700 ring-ink-300/40">
                      {humanise(o.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtKES(o.totalAmount)}</Td>
                  <Td className="text-xs text-ink-500">{fmtDate(o.placedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
