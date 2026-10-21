"use client";

/**
 * KoraAdmin shell.
 *
 * Professional shell with a grouped sidebar and a top bar. Every role entry
 * is role-filtered; server-side guards are the only source of truth.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import clsx from "clsx";
import { BRAND, ROLE_LABELS, KoraLogo } from "@kora/brand";
import { SECTIONS } from "./navigation";
import { ShellSearch } from "./shell-search";

type ShellUser = {
  id: string;
  email: string;
  fullName: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
  planTier?: string;
  planStatus?: string;
  grantedRoles?: string[];
  usableRoles?: string[];
};

const ACTIVE = "bg-brand-50 text-brand-800";
const INACTIVE = "text-ink-600 hover:bg-ink-100 hover:text-ink-900";

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/home": "Overview",
    "/pos": "Point of sale",
    "/sme/inventory": "Inventory",
    "/sme/sales": "Sales",
    "/sme/customers": "Customers",
    "/sme/suppliers": "Suppliers",
    "/sme/onboarding": "Setup",
    "/team": "Team",
    "/billing": "Billing",
    "/sme/loans": "Loans",
    "/sme/savings": "Savings",
    "/payments": "Payments",
    "/supplier/orders": "Orders",
    "/supplier/invoices": "Invoices",
    "/neobank": "NeoBank Dashboard",
    "/neobank/accounts": "Accounts",
    "/neobank/crypto": "Crypto",
    "/neobank/cards": "Cards",
    "/neobank/investments": "Investments",
    "/neobank/insurance": "Insurance",
    "/plans": "Plan",
    "/admin/overview": "Admin Overview",
    "/admin/loans": "Loans",
    "/admin/reports": "Reports",
    "/admin/transactions": "Transactions",
  };
  return map[pathname] ?? pathname.split("/").filter(Boolean).pop() ?? "Overview";
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const visible = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (i) =>
        i.roles.some((r) => user.usableRoles?.includes(r)) &&
        (!i.heldBy || user.usableRoles?.includes(i.heldBy)),
    ),
  })).filter((s) => s.items.length > 0);

  const searchEntries = visible.flatMap((s) =>
    s.items.map((i) => ({ href: i.href, label: i.label, group: s.group, icon: i.icon })),
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Surface the user rather than stranding them.
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-ink-200 bg-white transition-transform lg:static lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-ink-200 px-4">
          <Link href="/home" className="flex items-center gap-2.5" onClick={() => setNavOpen(false)}>
            <KoraLogo size={34} />
            <span className="text-sm font-bold leading-tight text-ink-900">{BRAND.displayName}</span>
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="ml-auto rounded-lg p-1 text-ink-500 hover:bg-ink-100 lg:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Primary">
          {visible.map((section) => (
            <div key={section.group}>
              <h2 className="px-2 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-widest text-ink-400">
                {section.group}
              </h2>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.href === pathname;
                  const show = !item.heldBy || user.usableRoles?.includes(item.heldBy);
                  return show ? (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setNavOpen(false)}
                        className={clsx(
                          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition",
                          active ? ACTIVE : INACTIVE,
                        )}
                      >
                        <span aria-hidden className={clsx("text-base", active ? "text-brand-600" : "text-ink-400")}>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink-800">{user.fullName}</p>
              <p className="truncate text-[11px] text-ink-500">{user.email}</p>
              <p className="truncate text-[11px] text-ink-400">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

        {/* Scrim for the mobile drawer. Outside the transformed <aside>, so its
            `position: fixed` is not scoped to the sidebar's containing block. */}
        {navOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          />
        )}

        {/* Content */}
        <div className="flex min-h-screen flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setNavOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
                aria-label="Toggle navigation"
                aria-expanded={navOpen}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-500" aria-label="Breadcrumb">
                <Link href="/home" className="truncate text-ink-700 hover:text-ink-900">
                  Overview
                </Link>
                <span className="text-ink-300" aria-hidden="true">
                  /
                </span>
                <span className="truncate text-ink-900">{getPageTitle(pathname)}</span>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-100"
                  onClick={() => setSearchOpen((v) => !v)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden sm:inline">Search</span>
                </button>

                <button
                  type="button"
                  className="relative flex items-center justify-center rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                  aria-label="Notifications"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .53-.21 1.04-.594 1.405L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-danger"></span>
                </button>

                {user.planTier && user.role !== "ADMIN" && (
                  <Link
                    href="/plans"
                    title="Your current plan"
                    className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-500/20"
                  >
                    {user.planTier}
                  </Link>
                )}
              </div>
            </div>
          </header>

          {/* Body */}
          <main className="flex-1 px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>

          <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-ink-400 sm:px-6">
            {`${new Date().getFullYear()} ${BRAND.legalEntity} · ${BRAND.tagline}`}
          </footer>
        </div>

        <ShellSearch entries={searchEntries} open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
  );
}
