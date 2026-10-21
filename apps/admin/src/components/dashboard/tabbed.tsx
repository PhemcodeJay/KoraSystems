"use client";

/**
 * Tabs.
 *
 * Accessible tabbed content. `items` are `{ id, label, icon?, panel }`. The
 * active tab is controlled by `active` (unless `defaultActiveId` is given,
 * in which case the first tab becomes active on mount). `onChange` is called
 * when the user switches tabs. Keyboard accessible (arrow keys + Enter).
 * Renders as a horizontally scrollable tab list with a tabpanel below.
 */

import type { ReactNode } from "react";
import clsx from "clsx";
import React from "react";

export function Tabs({
  items,
  defaultActiveId,
  active: controlledActive,
  onChange,
  className,
}: {
  items: { id: string; label: string; icon?: ReactNode; panel: ReactNode }[];
  defaultActiveId?: string;
  active?: string | null;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = React.useState<string | null>(defaultActiveId ?? null);
  const activeId = controlledActive ?? internal;

  React.useEffect(() => {
    if (controlledActive === undefined && internal !== defaultActiveId) {
      setInternal(defaultActiveId ?? null);
    }
  }, [controlledActive, defaultActiveId, internal]);

  const changeTab = (id: string) => {
    onChange?.(id);
    if (!controlledActive) setInternal(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next !== idx) {
      e.preventDefault();
      onChange?.(items[next].id);
    }
  };

  return (
    <div className={clsx("rounded-xl border bg-white shadow-sm", className)}>
      <div className="flex flex-wrap gap-1 border-b border-ink-200 px-1" role="tablist" aria-label="Dashboard sections">
        {items.map((item) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              id={`tab-${item.id}`}
              data-active={active}
              onClick={() => changeTab(item.id)}
              onKeyDown={(e) => handleKeyDown(e, item.id)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {item.icon && <span aria-hidden>{item.icon}</span>}
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {items.map((item) => (
          <div
            key={item.id}
            id={`panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${item.id}`}
            hidden={activeId !== item.id}
          >
            {item.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
