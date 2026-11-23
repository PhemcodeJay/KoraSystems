import { getOverview, getRevenueSeries, fmtKES, fmtNum, fmtPct } from "@/lib/queries";
import { Card, Stat } from "@/components/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

/**
 * Admin growth console.
 *
 * Shows how the platform is growing and making money: revenue trends,
 * user acquisition by role, and the revenue mix that drives the business.
 */
export default function AdminGrowthPage() {
  const d = getOverview();
  const series = getRevenueSeries(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Growth</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Platform growth and revenue trends
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          label="Revenue (30d)"
          value={fmtKES(d.revenue30)}
          tone="brand"
          hint={
            d.revenueGrowth === null
              ? "No prior period"
              : ${d.revenueGrowth >= 0 ? "▲" : "▼"}  vs previous 30d
          }
        />
        <Stat label="Businesses" value={fmtNum(d.smeCount)} />
        <Stat label="Customers" value={fmtNum(d.customerCount)} />
        <Stat label="Suppliers" value={fmtNum(d.supplierCount)} />
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Revenue trend (30 days)</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Daily sales revenue from completed transactions
            </p>
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={2}
                dot={{ fill: "#059669" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">User growth by role</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Active accounts by role on the platform
              </p>
            </div>
          </div>
          <div className="p-5">
            <BarChart width={400} height={200} data={[
              { name: "SMEs", value: d.smeCount },
              { name: "Customers", value: d.customerCount },
              { name: "Suppliers", value: d.supplierCount },
            ]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Outstanding credit</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Loan principal not yet repaid
              </p>
            </div>
          </div>
          <div className="p-5">
            <Stat label="Outstanding" value={fmtKES(d.outstanding)} tone="danger" />
            <Stat
              label="Repayment rate"
              value={fmtPct(d.repaymentRate)}
              hint={d.repaymentRate >= 0.8 ? "Healthy" : "Needs attention"}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Credit desk</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Loan applications awaiting your review
              </p>
            </div>
          </div>
          <div className="p-5">
            <Stat label="Pending review" value={fmtNum(d.pendingLoans.length)} tone="warning" />
            <Stat label="Total loans" value={fmtNum(d.loanCount)} />
          </div>
        </Card>
      </div>
    </div>
  );
}
