/**
 * Dashboard primitives — StatCard + KpiGrid.
 *
 * Professional KPI tiles for the KoraAdmin dashboards.
 */

import type { ReactNode } from "react";
import clsx from "clsx";

/** A single metric card. Shows a value, labelled dimension, optional delta
 * and a contextual hint. `tone` selects the accent border/background. */
export function StatCard({
  label,
  value,
  delta,
  hint,
  tone = "default",
  action,
}: {
  label: string;
  value: string;
  delta?: { value: number; label: string } | null;
  hint?: string;
  tone?: "default" | "brand" | "warning" | "success" | "danger";
  action?: ReactNode;
}) {
  const toneClass =
    tone === "brand"
      ? "border-brand-200 bg-brand-50/60 text-brand-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50/60 text-amber-900"
          : tone === "danger"
            ? "border-red-200 bg-red-50/60 text-red-900"
            : "border-ink-200 bg-white text-ink-900";

  return (
    <section className={clsx("rounded-xl border p-4 shadow-sm transition hover:shadow", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
        </div>
        {action}
      </div>
      {delta && (
        <p
          className={clsx(
            "mt-1 text-xs font-medium",
            delta.value >= 0 ? "text-emerald-600" : "text-red-600",
          )}
        >
          {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value * 100).toFixed(1)}% <span className="font-normal text-ink-500">{delta.label}</span>
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </section>
  );
}

/** Responsive grid of `StatCard`s. 4/6-col on desktop, shrinking on smaller
 * viewports. */
export function KpiGrid({
  cards,
  className,
}: {
  cards: { label: string; value: string; delta?: { value: number; label: string } | null; hint?: string; tone?: StatCard["tone"]; action?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={clsx("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {cards.map((c, i) => (
        <StatCard key={i} {...c} />
      ))}
    </div>
  );
}
