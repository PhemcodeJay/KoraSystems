"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/neobank", label: "Dashboard", icon: "🏠" },
  { href: "/neobank/accounts", label: "Accounts", icon: "🏦" },
  { href: "/neobank/crypto", label: "Crypto", icon: "₿" },
  { href: "/neobank/cards", label: "Cards", icon: "💳" },
  { href: "/neobank/investments", label: "Investments", icon: "📈" },
  { href: "/neobank/insurance", label: "Insurance", icon: "🛡️" },
  { href: "/plans", label: "Plans", icon: "⭐" },
];

/**
 * The Neobank tab bar.
 *
 * A Client Component because `usePathname` only works in one. It was called
 * inside `.map()` directly in the Server Component layout, which failed the
 * build with "importing a component that needs usePathname" — so `/neobank`
 * and every page under it returned HTTP 500 for all users, including the
 * Enterprise accounts paying for it.
 *
 * The hook is now called once, at the top of a real component, rather than once
 * per tab, which is also what the Rules of Hooks require.
 */
export function NeobankTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto border-b border-ink-200 pb-2">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <span aria-hidden className="mr-1">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}