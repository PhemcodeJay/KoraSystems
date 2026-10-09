import Link from "next/link";
import { requireSme } from "@kora/auth/guards";
import { getSmeOverview, fmtKES, fmtNum, fmtDateTime } from "@/lib/queries";
import {
  Badge,
  Card,
  Empty,
  LOAN_STYLES,
  Stat,
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";

/** Shortcuts into the rest of the unified app. */
const ACTIONS = [
  { href: "/pos", label: "New sale", hint: "Ring up a sale at the till" },
  { href: "/sme/inventory", label: "Adjust stock", hint: "Deliveries and write-offs" },
  { href: "/payments", label: "Payments", hint: "M-Pesa, wallet and ledger" },
  { href: "/sme/loans", label: "Apply for credit", hint: "Loans and BNPL" },
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
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{sme.businessName}</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {sme.businessType} · {sme.town}, {sme.county} · {sme.yearsInBusiness}{" "}
          yrs trading
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (30d)" value={fmtKES(d.revenue30)} tone="brand" />
        <Stat label="Sales (30d)" value={fmtNum(d.salesCount30)} />
        <Stat
          label="Credit score"
          value={cs ? `${cs.score}/1000` : "—"}
          hint={cs ? humanise(cs.riskLevel) : "Not scored yet"}
        />
        <Stat
          label="Savings"
          value={d.savings ? fmtKES(d.savings.balance) : "—"}
          hint={d.lowStock > 0 ? `${d.lowStock} products low` : "Stock healthy"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {d.insights.length > 0 && (
        <Card title="Insights">
          <ul className="space-y-3">
            {d.insights.map((i) => (
              <li key={i.id} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium text-ink-900">{i.title}</p>
                <p className="mt-0.5 text-sm text-ink-600">{i.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent sales">
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
                    <Td className="text-right font-medium tabular-nums">
                      {fmtKES(s.totalAmount)}
                    </Td>
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
      </div>
    </div>
  );
}