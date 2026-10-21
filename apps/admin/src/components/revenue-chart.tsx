"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { COLOR } from "@kora/brand";
import { fmtKES } from "@/lib/queries";

/**
 * Recharts touches the DOM, so it must render on the client only. Keeping it
 * in its own client component means the overview page itself can stay a
 * Server Component and still stream its data straight from Postgres.
 */
export function RevenueChart({
  data,
  peak,
}: {
  data: Array<{ label: string; revenue: number; sales: number }>;
  peak: { label: string; revenue: number };
}) {
  return (
    <>
      <p className="mb-3 text-xs text-ink-500">
        Peak {fmtKES(peak.revenue)} on {peak.label}
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="koraRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND_CHART} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND_CHART} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={70}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <Tooltip
            formatter={(v: number) => [fmtKES(v), "Revenue"]}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={BRAND_CHART}
            strokeWidth={2}
            fill="url(#koraRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </>
  );
}

/**
 * Brand colour for the chart. Read from @kora/brand rather than hardcoded, so
 * the chart follows the brand palette on a rebrand. Recharts needs a literal
 * colour string for SVG fills, which CSS custom properties do not resolve.
 */
const BRAND_CHART = COLOR.primary[500];
