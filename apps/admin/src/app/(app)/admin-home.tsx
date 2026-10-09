import Link from "next/link";
import { requireRole } from "@kora/auth/guards";
import {
  getOverview,
  fmtKES,
  fmtNum,
  fmtPct,
  fmtDate,
} from "@/lib/queries";
import {
  Badge,
  Card,
  Empty,
  LOAN_STYLES,
  RISK_STYLES,
  Stat,
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";

const ACTIONS = [
  { href: "/admin/smes", label: "Businesses", hint: "Onboarding and accounts" },
  { href: "/admin/loans", label: "Credit desk", hint: "Approve or reject applications" },
  { href: "/admin/transactions", label: "Ledger", hint: "Every posting, balanced" },
  { href: "/admin/reports", label: "Reports", hint: "Revenue and insights" },
];

/** The platform console. ADMIN only, enforced by requireRole. */
export async function AdminHome() {
  await requireRole("ADMIN");
  const d = await getOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Platform console</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {fmtNum(d.smeCount)} businesses · {fmtNum(d.customerCount)} customers ·{" "}
          {fmtNum(d.supplierCount)} suppliers
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (30d)" value={fmtKES(d.revenue30)} tone="brand" />
        <Stat
          label="vs previous 30d"
          value={d.revenueGrowth === null ? "—" : fmtPct(d.revenueGrowth)}
          hint="Change on the prior 30 days"
        />
        <Stat label="Sales (365d)" value={fmtNum(d.salesCount365)} />
        <Stat
          label="Outstanding credit"
          value={fmtKES(d.outstanding)}
          hint={`${fmtPct(d.repaymentRate)} repaid across ${fmtNum(d.loanCount)} loans`}
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

      <Card
        title="Credit applications awaiting review"
        hint="Approval never moves money — disbursement is gated"
      >
        {d.pendingLoans.length === 0 ? (
          <Empty message="Nothing waiting for review." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Loan</Th>
                <Th>Business</Th>
                <Th>Risk</Th>
                <Th className="text-right">Requested</Th>
                <Th>Applied</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {d.pendingLoans.map((l) => {
                const cs = l.creditScores[0];
                return (
                  <tr key={l.id}>
                    <Td className="font-medium text-ink-900">{l.loanNumber}</Td>
                    <Td className="text-sm">{l.sme?.businessName ?? "—"}</Td>
                    <Td>
                      {cs ? (
                        <Badge className={RISK_STYLES[cs.riskLevel]}>
                          {cs.score} · {humanise(cs.riskLevel)}
                        </Badge>
                      ) : (
                        <Badge className={LOAN_STYLES.PENDING_REVIEW}>
                          Unscored
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {fmtKES(l.principal)}
                    </Td>
                    <Td className="text-xs">{fmtDate(l.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}