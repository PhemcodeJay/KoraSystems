"use client";

/**
 * Shell command palette.
 *
 * A lightweight, client-side search over the visible navigation. Filters as
 * the user types, supports arrow-key selection and Enter to navigate, and
 * closes on Escape or an outside click.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type SearchEntry = {
  href: string;
  label: string;
  group: string;
  icon: string;
};

export function ShellSearch({
  entries,
  open,
  onClose,
}: {
  entries: SearchEntry[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 8);
    return entries
      .filter(
        (e) =>
          e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after the panel paints, otherwise the browser drops it.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      window.location.href = results[cursor].href;
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 px-4 pt-24 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-ink-200 px-3">
          <svg className="h-4 w-4 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages…"
            aria-label="Search pages"
            className="h-11 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            ESC
          </button>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-500">No pages match “{query}”.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {results.map((r, i) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  onClick={onClose}
                  onMouseEnter={() => setCursor(i)}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                    i === cursor ? "bg-brand-50 text-brand-900" : "text-ink-700 hover:bg-ink-100",
                  )}
                >
                  <span aria-hidden className="text-base">
                    {r.icon}
                  </span>
                  <span className="flex-1 font-medium">{r.label}</span>
                  <span className="text-[11px] uppercase tracking-wide text-ink-400">{r.group}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
