import { requireCustomer } from "@kora/auth/guards";
import {
  getCustomerOverview,
  fmtKES,
  fmtNum,
  fmtDate,
  fmtPct,
} from "@/lib/queries";
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

/** Everything a customer may see, scoped to their own profile. */
export async function CustomerView() {
  const { customer } = await requireCustomer();
  const d = await getCustomerOverview(customer.id);

  // Decimal arithmetic: convert before subtracting, not after.
  const outstanding = d.bnpl
    .flatMap((b) => b.installments)
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + (Number(i.amountDue) - Number(i.amountPaid)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{customer.fullName}</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {customer.town}, {customer.county} · {customer.phone}
        </p>
      </div>

      <ComingSoonNotice app={APPS.customer.name} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Loyalty points" value={fmtNum(customer.loyaltyPoints)} tone="brand" />
        <Stat label="Tier" value={customer.loyaltyTier} />
        <Stat label="Purchases" value={fmtNum(d.purchaseCount)} />
        <Stat
          label="BNPL outstanding"
          value={fmtKES(outstanding)}
          hint={
            customer.creditScore ? `Credit score ${customer.creditScore}` : undefined
          }
          tone={outstanding > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Purchase history">
          {d.sales.length === 0 ? (
            <Empty message="No purchases yet." />
          ) : (
            <Table>
              <thead className="bg-ink-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Business</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {d.sales.map((s) => (
                  <tr key={s.id}>
                    <Td className="text-xs">{fmtDate(s.soldAt)}</Td>
                    <Td className="text-sm">{s.sme.businessName}</Td>
                    <Td className="text-right font-medium tabular-nums">
                      {fmtKES(s.totalAmount)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="BNPL plans">
          {d.bnpl.length === 0 ? (
            <Empty message="No BNPL plans." />
          ) : (
            <ul className="space-y-3">
              {d.bnpl.map((b) => {
                const paid = b.installments.filter((i) => i.status === "PAID").length;
                const pct =
                  b.installments.length > 0 ? paid / b.installments.length : 0;
                return (
                  <li key={b.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900">
                        {b.sme.businessName}
                      </p>
                      <Badge className="bg-ink-100 text-ink-700 ring-ink-300/40">
                        {humanise(b.status)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {b.reference} · {fmtKES(b.financedAmount)} over{" "}
                      {b.installmentCount} instalments
                    </p>
                    <p className="mt-1 text-xs text-ink-600">
                      {paid}/{b.installments.length} paid ({fmtPct(pct)})
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
