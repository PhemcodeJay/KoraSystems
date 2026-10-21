/**
 * Page header.
 *
 * A consistent top-of-page block: large title, optional description, and a
 * right-aligned actions strip (buttons, dropdowns, icons). Hides itself on
 * very small screens in favour of a compact title row.
 */

import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        {children}
      </div>
    </div>
  );
}
