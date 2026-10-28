"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { BRAND, ROLE_LABELS, KoraLogo } from "@kora/brand";
// The tier *names* live in one table. A local copy here would drift from the
// pricing page and from what the server guards enforce, which is the exact
// duplication `@kora/auth/entitlements` exists to prevent. The module is a
// pure const with no Prisma import, so it is safe in a client component.
import { TIERS, type Tier } from "@kora/auth/entitlements";

type ShellUser = {
  id: string;
  email: string;
  fullName: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
  planTier?: string;
  planStatus?: string;
  grantedRoles?: string[];
  /** Roles with a profile behind them; what the nav actually filters on. */
  usableRoles?: string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Primary roles that see this entry. */
  roles: string[];
  /**
   * The role the user must HOLD — not merely be — to open this entry.
   *
   * Separate from `roles` because a granted role is the whole point of a paid
   * tier: an Enterprise SME is granted SUPPLIER, and should see the supplier
   * links. Filtering on the primary role alone hid them; showing them
   * unconditionally gave a Starter SME links to pages that 403'd. Both failure
   * modes were live before this field existed.
   */
  heldBy?: string;
};

/**
 * One navigation model for the whole platform.
 *
 * There used to be two separate shells — `AdminShell` for ADMIN and
 * `AccountShell` for everyone else — so an SME and an admin reached their pages
 * through different code paths at different URLs. It is now one app on one
 * origin, so there is one list, filtered by role.
 *
 * `/` is the public landing page, so the signed-in overview lands at /home.
 * `roles` controls what is *offered*, never what is *allowed*: every page
 * re-checks the session server-side, so hiding a link cannot open a door.
 */
const SECTIONS: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Business",
    items: [
      { href: "/home", label: "Overview", icon: "▦", roles: ["ADMIN", "SME", "SUPPLIER"] },
      { href: "/pos", label: "Point of sale", icon: "▣", roles: ["SME"] },
      { href: "/sme/inventory", label: "Inventory", icon: "◫", roles: ["SME"] },
      { href: "/sme/sales", label: "Sales", icon: "⇅", roles: ["SME", "ADMIN"] },
      { href: "/sme/customers", label: "Customers", icon: "☺", roles: ["SME"] },
      { href: "/sme/suppliers", label: "Suppliers", icon: "⛟", roles: ["SME"] },
      { href: "/sme/onboarding", label: "Setup", icon: "⚙", roles: ["SME"] },
      { href: "/team", label: "Team", icon: "☺", roles: ["SME"] },
      { href: "/billing", label: "Billing", icon: "◈", roles: ["SME"] },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/sme/loans", label: "Loans", icon: "◈", roles: ["SME", "ADMIN"] },
      { href: "/sme/savings", label: "Savings", icon: "⬢", roles: ["SME"] },
      { href: "/payments", label: "Payments", icon: "⇄", roles: ["SME", "SUPPLIER", "ADMIN"] },
      { href: "/supplier/orders", label: "Orders", icon: "⇉", roles: ["SUPPLIER", "SME", "ADMIN"], heldBy: "SUPPLIER" },
      { href: "/supplier/invoices", label: "Invoices", icon: "▤", roles: ["SUPPLIER", "SME", "ADMIN"], heldBy: "SUPPLIER" },
    ],
  },
  {
    group: "NeoBank",
    items: [
      { href: "/plans", label: "Plans", icon: "⭐", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
    ],
  },
  {
    group: "Growth",
    items: [
      { href: "/growth", label: "Sales agent", icon: "✦", roles: ["SME", "ADMIN"] },
    ],
  },
  {
    group: "Shop",
    items: [
      { href: "/customer/shop", label: "Shop", icon: "◇", roles: ["CUSTOMER", "SME", "SUPPLIER"], heldBy: "CUSTOMER" },
      { href: "/customer/cart", label: "Cart", icon: "⊕", roles: ["CUSTOMER", "SME", "SUPPLIER"], heldBy: "CUSTOMER" },
    ],
  },
  {
    group: "Platform",
    items: [
      { href: "/account", label: "My account", icon: "☺", roles: ["SME", "SUPPLIER", "CUSTOMER"] },
      { href: "/apps", label: "My apps", icon: "◈", roles: ["ADMIN", "SME", "SUPPLIER", "CUSTOMER"] },
      { href: "/admin/overview", label: "Console", icon: "▦", roles: ["ADMIN"] },
      { href: "/admin/users", label: "Users", icon: "☺", roles: ["ADMIN"] },
      { href: "/admin/smes", label: "Businesses", icon: "◧", roles: ["ADMIN"] },
      { href: "/admin/loans", label: "Credit desk", icon: "◈", roles: ["ADMIN"] },
      { href: "/admin/transactions", label: "Ledger", icon: "⇄", roles: ["ADMIN"] },
      { href: "/admin/reports", label: "Reports", icon: "◱", roles: ["ADMIN"] },
    ],
  },
];

/** Where each role lands. One entry point, no separate dashboards. */
export const HOME_FOR: Record<ShellUser["role"], string> = {
  ADMIN: "/admin/overview",
  SME: "/home",
  SUPPLIER: "/neobank",
  CUSTOMER: "/neobank",
};

function isActive(href: string, pathname: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Sections this user can actually open, in order.
 *
 * Takes the FULL role set — primary plus granted — because a paid tier's
 * secondary role is exactly what unlocks the supplier and shopper surfaces. An
 * entry survives only when the user holds a role in `roles` AND, if it declares
 * `heldBy`, genuinely holds that role too.
 *
 * The goal is that nothing in the nav can 403: hiding an entry the user cannot
 * use removes a dead end, and hiding one they paid for removes a feature.
 */
export function sectionsFor(held: string[]) {
  return SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.roles.some((r) => held.includes(r)) &&
        (!item.heldBy || held.includes(item.heldBy)),
    ),
  })).filter((section) => section.items.length > 0);
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Every role sees the same sections it always did, plus the app hub. Nav
  // filters by *role*; product access is enforced by `requireApp` server-side.
  // Filtering the nav by tier instead would hide the upgrade path — a locked
  // product has to be discoverable, or nobody knows it exists.
  // `usableRoles`, not `grantedRoles`: a granted role with no profile row behind
  // it opens nothing, so linking to it would just move the dead end from the
  // guard into the menu. Falls back to the primary role for older sessions.
  const visible = sectionsFor(user.usableRoles ?? [user.role]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Send the user to sign-in even if the request failed, rather than
      // stranding them on a page they can no longer use.
    }
    router.push("/login");
    router.refresh();
  }

  const link = (
    item: NavItem,
    compact: boolean,
  ): React.ReactNode => {
    const active = isActive(item.href, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          compact
            ? "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium"
            : "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition",
          active
            ? "bg-brand-50 text-brand-800"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        {!compact && (
          <span aria-hidden className="text-ink-400">
            {item.icon}
          </span>
        )}
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href={HOME_FOR[user.role]} className="flex items-center gap-2.5">
            <KoraLogo size={32} />
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-ink-900">
                {BRAND.name}
              </span>
              <span className="text-[11px] text-ink-500">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </Link>

          {/* Desktop nav. Every entry has a matching page under src/app. */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {visible.flatMap((s) => s.items.map((i) => link(i, false)))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user.planTier && user.role !== "ADMIN" && (
              <Link
                href="/plans"
                title="Your current plan"
                className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-500/20 sm:inline-block"
              >
                {TIERS[user.planTier as Tier]?.name ?? user.planTier}
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight text-ink-800">
                {user.fullName}
              </p>
              <p className="text-[11px] leading-tight text-ink-500">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Compact nav. Shares isActive() with the desktop nav. */}
        <nav
          className="flex items-center gap-1 overflow-x-auto border-t border-ink-200 px-4 py-1.5 lg:hidden sm:px-6"
          aria-label="Primary (compact)"
        >
          {visible.flatMap((s) => s.items.map((i) => link(i, true)))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-xs text-ink-400 sm:px-6">
        {`© ${new Date().getFullYear()} ${BRAND.legalEntity} · ${BRAND.tagline}`}
      </footer>
    </div>
  );
}
