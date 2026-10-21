/**
 * Dashboard primitives — ActionTile + ActionGrid.
 *
 * Shortcut tiles for the "what do I want to do next?" row that sits under the
 * KPI cards. Each tile is a link with an icon, a label and a hint.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";

export function ActionTile({
  href,
  label,
  hint,
  icon,
  tone = "default",
}: {
  href: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "brand";
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group flex items-start gap-3 rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow",
        tone === "brand"
          ? "border-brand-200 bg-brand-50/60 hover:border-brand-400"
          : "border-ink-200 bg-white hover:border-brand-300",
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={clsx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base",
            tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900 group-hover:text-brand-800">
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
    </Link>
  );
}

/** Responsive grid of `ActionTile`s. */
export function ActionGrid({
  actions,
  columns = 4,
  className,
}: {
  actions: { href: string; label: string; hint?: string; icon?: ReactNode; tone?: "default" | "brand" }[];
  /** How many tiles per row on large screens. */
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={clsx("grid gap-3", cols, className)}>
      {actions.map((a) => (
        <ActionTile key={a.href} {...a} />
      ))}
    </div>
  );
}
