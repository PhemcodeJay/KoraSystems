import { requireCustomer } from "@kora/auth/guards";
import { getCustomerOverview, fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Table, Td, Th, humanise } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiGrid } from "@/components/dashboard/stat-card";
import { ActionGrid } from "@/components/dashboard/action-tiles";
import { Tabs } from "@/components/dashboard/tabbed";

const ACTIONS = [
  { href: "/customer/shop", label: "Shop", hint: "Browse what local businesses are selling", icon: "\uD83D\uDED2", tone: "brand" as const },
  { href: "/payments", label: "Payments", hint: "M-Pesa, wallet and your purchase history", icon: "\u21C4" },
];

/** The customer landing page, scoped to the signed-in shopper. */
export async function CustomerHome() {
  const { customer } = await requireCustomer();
  const d = await getCustomerOverview(customer.id);

  const tier = customer.loyaltyTier ?? "BRONZE";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${customer.fullName}`}
        description={`${tier} member · ${customer.loyaltyPoints} points${customer.town ? ` · ${customer.town}` : ""}`}
      />

      <KpiGrid
        cards={[
          { label: "Lifetime spend", value: fmtKES(d.lifetimeSpend), tone: "brand" },
          { label: "Purchases", value: String(d.purchaseCount) },
          {
            label: "Credit available",
            value: fmtKES(Number(customer.creditLimit ?? 0) - Number(customer.creditUsed ?? 0)),
            hint: "Buy now, pay later",
          },
        ]}
      />

      <ActionGrid actions={ACTIONS} columns={2} />

      <Tabs
        items={[
          {
            id: "purchases",
            label: "Recent purchases",
            panel: (
              <Card title="Recent purchases" hint={`${d.sales.length} shown`}>
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
                          <Td className="text-right font-medium tabular-nums">{fmtKES(s.totalAmount)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            ),
          },
          {
            id: "bnpl",
            label: "Pay-later plans",
            panel: (
              <Card title="Pay-later plans" hint={`${d.bnpl.length} active`}>
                {d.bnpl.length === 0 ? (
                  <Empty message="No pay-later plans." />
                ) : (
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
                          <Td className="text-right tabular-nums">{fmtKES(b.totalAmount)}</Td>
                          <Td className="text-xs">{b.installments.length}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}