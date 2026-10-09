import type { ReactNode } from "react";
import clsx from "clsx";

/** Tailwind classes for the Prisma enums, so status colour is consistent. */
export const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  MEDIUM: "bg-amber-50 text-amber-800 ring-amber-600/20",
  HIGH: "bg-orange-50 text-orange-800 ring-orange-600/20",
  VERY_HIGH: "bg-red-50 text-red-700 ring-red-600/20",
};

export const LOAN_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-amber-600/20",
  APPROVED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
  DISBURSEMENT_PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  DISBURSED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  REPAYING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SETTLED: "bg-slate-100 text-slate-700 ring-slate-500/20",
  DEFAULTED: "bg-red-50 text-red-700 ring-red-600/20",
  BLOCKED_NO_PARTNER: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export const humanise = (s: string): string =>
  s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function Badge({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        className ?? "bg-slate-100 text-slate-700 ring-slate-500/20",
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  hint,
  action,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-ink-200 bg-white shadow-sm",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** KPI tile. */
export function Stat({
  label,
  value,
  delta,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: { value: number; label: string } | null;
  hint?: string;
  tone?: "default" | "brand" | "warning";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-4 shadow-sm",
        tone === "brand"
          ? "border-brand-200 bg-brand-50/60"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50/60"
            : "border-ink-200 bg-white",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {delta && (
        <p
          className={clsx(
            "mt-1 text-xs font-medium",
            delta.value >= 0 ? "text-emerald-600" : "text-red-600",
          )}
        >
          {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value * 100).toFixed(1)}%{" "}
          <span className="font-normal text-ink-500">{delta.label}</span>
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="min-w-full divide-y divide-ink-200 text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={clsx(
        "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={clsx("px-3 py-2.5 align-middle text-ink-700", className)}>
      {children}
    </td>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-ink-500">{message}</p>
  );
}
