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
  Table,
  Td,
  Th,
  humanise,
} from "@/components/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiGrid } from "@/components/dashboard/stat-card";
import { ActionGrid } from "@/components/dashboard/action-tiles";
import { Tabs } from "@/components/dashboard/tabbed";

const ACTIONS = [
  { href: "/admin/smes", label: "Businesses", hint: "Onboarding and accounts", icon: "\u25FB" },
  { href: "/admin/loans", label: "Credit desk", hint: "Approve or reject applications", icon: "\u25C8", tone: "brand" as const },
  { href: "/admin/transactions", label: "Ledger", hint: "Every posting, balanced", icon: "\u21C4" },
  { href: "/admin/reports", label: "Reports", hint: "Revenue and insights", icon: "\u2696" },
];

/** The platform console. ADMIN only, enforced by requireRole. */
export async function AdminHome() {
  await requireRole("ADMIN");
  const d = await getOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform console"
        description={`${fmtNum(d.smeCount)} businesses · ${fmtNum(d.customerCount)} customers · ${fmtNum(d.supplierCount)} suppliers`}
      />

      <KpiGrid
        cards={[
          { label: "Revenue (30d)", value: fmtKES(d.revenue30), tone: "brand" },
          {
            label: "vs previous 30d",
            value: d.revenueGrowth === null ? "—" : fmtPct(d.revenueGrowth),
            hint: "Change on the prior 30 days",
            tone: (d.revenueGrowth ?? 0) >= 0 ? "success" : "danger",
          },
          { label: "Sales (365d)", value: fmtNum(d.salesCount365) },
          {
            label: "Outstanding credit",
            value: fmtKES(d.outstanding),
            hint: `${fmtPct(d.repaymentRate)} repaid across ${fmtNum(d.loanCount)} loans`,
          },
        ]}
      />

      <ActionGrid actions={ACTIONS} />

      <Tabs
        items={[
          {
            id: "credit",
            label: "Credit applications",
            panel: (
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
                            <Td className="text-right tabular-nums">{fmtKES(l.principal)}</Td>
                            <Td className="text-xs">{fmtDate(l.createdAt)}</Td>
                          </tr>
                        );
                      })}
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