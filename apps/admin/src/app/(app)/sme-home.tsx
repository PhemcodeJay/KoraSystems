import Link from "next/link";
import { requireSme } from "@kora/auth/guards";
import { getSmeOverview, fmtKES, fmtNum, fmtDateTime } from "@/lib/queries";
import {
  Badge,
  Card,
  Empty,
  LOAN_STYLES,
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiGrid } from "@/components/dashboard/stat-card";
import { ActionGrid } from "@/components/dashboard/action-tiles";
import { Tabs } from "@/components/dashboard/tabbed";

/** Shortcuts into the rest of the unified app. */
const ACTIONS = [
  { href: "/pos", label: "New sale", hint: "Ring up a sale at the till", icon: "\u25A3", tone: "brand" as const },
  { href: "/sme/inventory", label: "Adjust stock", hint: "Deliveries and write-offs", icon: "\u25FB" },
  { href: "/payments", label: "Payments", hint: "M-Pesa, wallet and ledger", icon: "\u21C4" },
  { href: "/sme/loans", label: "Apply for credit", hint: "Loans and BNPL", icon: "\u25C8" },
];

/**
 * The SME landing page.
 *
 * Reads the same scoped queries the old /account view used, but now sits in the
 * shared shell alongside the POS, payments and platform sections instead of on
 * a separate origin.
 */
export async function SmeHome() {
  const { sme } = await requireSme();
  const d = await getSmeOverview(sme.id);
  const cs = d.loans[0]?.creditScores[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={sme.businessName}
        description={`${sme.businessType} · ${sme.town}, ${sme.county} · ${sme.yearsInBusiness} yrs trading`}
        action={
          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New sale
          </Link>
        }
      />

      <KpiGrid
        cards={[
          { label: "Revenue (30d)", value: fmtKES(d.revenue30), tone: "brand" },
          { label: "Sales (30d)", value: fmtNum(d.salesCount30), hint: `${d.customers} customers served` },
          {
            label: "Credit score",
            value: cs ? `${cs.score}/1000` : "—",
            hint: cs ? humanise(cs.riskLevel) : "Not scored yet",
          },
          {
            label: "Savings",
            value: d.savings ? fmtKES(d.savings.balance) : "—",
            hint: d.lowStock > 0 ? `${d.lowStock} products low` : "Stock healthy",
            tone: d.lowStock > 0 ? "warning" : "default",
          },
        ]}
      />

      <ActionGrid actions={ACTIONS} />

      <Tabs
        items={[
          {
            id: "sales",
            label: "Recent sales",
            panel: (
              <Card title="Recent sales" hint={`Last ${d.recentSales.length} transactions`}>
                {d.recentSales.length === 0 ? (
                  <Empty message="No sales recorded yet." />
                ) : (
                  <Table>
                    <thead className="bg-ink-50">
                      <tr>
                        <Th>When</Th>
                        <Th>Customer</Th>
                        <Th className="text-right">Amount</Th>
                        <Th>Method</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {d.recentSales.map((s) => (
                        <tr key={s.id}>
                          <Td className="text-xs">{fmtDateTime(s.soldAt)}</Td>
                          <Td className="text-sm">{s.customer?.fullName ?? "Walk-in"}</Td>
                          <Td className="text-right font-medium tabular-nums">{fmtKES(s.totalAmount)}</Td>
                          <Td>
                            <Badge className="bg-ink-100 text-ink-700 ring-ink-300/40">
                              {humanise(s.paymentMethod)}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            ),
          },
          {
            id: "stock",
            label: "Stock",
            panel: (
              <Card title="Stock" hint={`${d.products.length} active products`}>
                {d.products.length === 0 ? (
                  <Empty message="No products yet." />
                ) : (
                  <Table>
                    <thead className="bg-ink-50">
                      <tr>
                        <Th>Product</Th>
                        <Th className="text-right">Price</Th>
                        <Th className="text-right">Stock</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {d.products.map((p) => (
                        <tr key={p.id}>
                          <Td>
                            <div className="font-medium text-ink-900">{p.name}</div>
                            <div className="text-xs text-ink-500">{p.sku}</div>
                          </Td>
                          <Td className="text-right tabular-nums">{fmtKES(p.price)}</Td>
                          <Td className="text-right">
                            <span
                              className={
                                p.stockQuantity <= p.reorderLevel
                                  ? "font-semibold text-red-600"
                                  : "text-ink-700"
                              }
                            >
                              {p.stockQuantity}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            ),
          },
          {
            id: "credit",
            label: "Credit",
            panel: (
              <Card title="Loans & credit" hint={`${d.loans.length} applications`}>
                {d.loans.length === 0 ? (
                  <Empty message="No loan applications yet." />
                ) : (
                  <Table>
                    <thead className="bg-ink-50">
                      <tr>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Applied</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {d.loans.map((l) => (
                        <tr key={l.id}>
                          <Td className="font-medium tabular-nums">{fmtKES(l.principal)}</Td>
                          <Td>
                            <Badge className={LOAN_STYLES[l.status] ?? ""}>{humanise(l.status)}</Badge>
                          </Td>
                          <Td className="text-right text-xs">{fmtDateTime(l.createdAt)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            ),
          },
          {
            id: "insights",
            label: "Insights",
            panel: (
              <Card title="Insights" hint="Generated from your trading patterns">
                {d.insights.length === 0 ? (
                  <Empty message="No insights yet — keep trading to unlock them." />
                ) : (
                  <ul className="space-y-3">
                    {d.insights.map((i) => (
                      <li key={i.id} className="rounded-lg border border-ink-200 p-3">
                        <p className="text-sm font-medium text-ink-900">{i.title}</p>
                        <p className="mt-0.5 text-sm text-ink-600">{i.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

