import Link from "next/link";
import { requireCustomer } from "@kora/auth/guards";
import { getCustomerOverview, fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

/** The customer landing page, scoped to the signed-in shopper. */
export async function CustomerHome() {
  const { customer } = await requireCustomer();
  const d = await getCustomerOverview(customer.id);

  const tier = customer.loyaltyTier ?? "BRONZE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">
          Hello, {customer.fullName}
        </h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {tier} member · {customer.loyaltyPoints} points
          {customer.town ? ` · ${customer.town}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lifetime spend" value={fmtKES(d.lifetimeSpend)} tone="brand" />
        <Stat label="Purchases" value={String(d.purchaseCount)} />
        <Stat
          label="Credit available"
          value={fmtKES(Number(customer.creditLimit ?? 0) - Number(customer.creditUsed ?? 0))}
          hint="Buy now, pay later"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/customer/shop"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Shop</p>
          <p className="mt-0.5 text-xs text-ink-500">
            Browse what local businesses are selling
          </p>
        </Link>
        <Link
          href="/payments"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Payments</p>
          <p className="mt-0.5 text-xs text-ink-500">
            M-Pesa, wallet and your purchase history
          </p>
        </Link>
      </div>

      <Card title="Recent purchases">
        {d.sales.length === 0 ? (
          <Empty message="You have not bought anything yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Date</Th>
                <Th>Business</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.sales.map((s) => (
                <tr key={s.id}>
                  <Td className="text-xs">{fmtDate(s.soldAt)}</Td>
                  <Td className="text-sm">{s.sme?.businessName ?? "—"}</Td>
                  <Td className="text-xs">{humanise(s.paymentMethod)}</Td>
                  <Td>
                    <Badge
                      className={
                        s.paymentStatus === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-800 ring-amber-600/20"
                      }
                    >
                      {humanise(s.paymentStatus)}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(s.totalAmount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {d.bnpl.length > 0 && (
        <Card title="Pay-later plans">
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Plan</Th>
                <Th>Business</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>Instalments</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.bnpl.map((b) => (
                <tr key={b.id}>
                  <Td className="text-sm">{b.reference}</Td>
                  <Td className="text-sm">{b.sme?.businessName ?? "—"}</Td>
                  <Td>
                    <Badge>{humanise(b.status)}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtKES(b.totalAmount)}
                  </Td>
                  <Td className="text-xs">{b.installments.length}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}