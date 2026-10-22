import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";
import { Card, Empty } from "@/components/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiGrid } from "@/components/dashboard/stat-card";
import { ActionGrid } from "@/components/dashboard/action-tiles";
import { Tabs } from "@/components/dashboard/tabbed";

// Mock crypto prices for display
const CRYPTO_PRICES: Record<string, number> = {
  BTC: 81500,
  ETH: 2500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
};

const SERVICES = [
  { href: "/neobank/accounts", label: "Bank Accounts", hint: "Checking, Savings, Loans", icon: "🏦", tone: "brand" as const },
  { href: "/neobank/crypto", label: "Crypto Wallets", hint: "USDT, USDC, BTC, ETH, SOL", icon: "₿" },
  { href: "/neobank/cards", label: "Cards", hint: "Physical & Virtual cards", icon: "💳" },
  { href: "/neobank/lending", label: "Lending", hint: "Apply for a business loan", icon: "💸" },
  { href: "/neobank/investments", label: "Investments", hint: "Crypto portfolio", icon: "📈" },
];

const MORE_SERVICES = [
  { href: "/neobank/insurance", label: "Insurance Marketplace", hint: "Health, Auto, Travel, Device", icon: "🛡️" },
  { href: "/plans", label: "Upgrade Plan", hint: "Access premium features", icon: "⭐" },
];

/** NeoBank Dashboard - Banking, Crypto, Cards, Investments, Insurance */
export default async function Page() {
  // requireRole throws ForbiddenError rather than returning a result, so the
  // check is a try/catch. The previous `authResult?.props?.redirect` shape came
  // from a helper that was expected to return a response — it never did, and
  // the property access silently compiled to `undefined`, so the guard never
  // fired and the page rendered for any signed-in role.
  try {
    await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  } catch {
    redirect("/home");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="NeoBank Dashboard"
        description="Banking, Crypto, Cards, Investments & Insurance — your money, one place."
        action={
          <Link
            href="/neobank/crypto"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New transfer
          </Link>
        }
      />

      <KpiGrid
        cards={[
          { label: "Total balance", value: "—", hint: "Connect an account to see it", tone: "brand" },
          { label: "Assets tracked", value: "5", hint: "BTC, ETH, SOL, USDT, USDC" },
          { label: "Cards", value: "0", hint: "Physical and virtual" },
          { label: "Insurance", value: "0", hint: "Active policies" },
        ]}
      />

      <ActionGrid actions={SERVICES} />

      <Tabs
        items={[
          {
            id: "accounts",
            label: "Bank accounts",
            panel: (
              <Card title="Bank Accounts" hint="Checking, savings and loan facilities">
                <Empty message="No accounts linked yet — open the Accounts section to get started." />
              </Card>
            ),
          },
          {
            id: "crypto",
            label: "Crypto",
            panel: (
              <Card title="Crypto holdings" hint="Indicative market prices">
                <CryptoSummary />
              </Card>
            ),
          },
          {
            id: "lending",
            label: "Lending",
            panel: (
              <Card title="Business Lending" hint="Apply for a loan or check your application status">
                <LendingSummary />
              </Card>
            ),
          },
          {
            id: "services",
            label: "More services",
            panel: (
              <div className="grid gap-3 sm:grid-cols-2">
                {MORE_SERVICES.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
                  >
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-base text-ink-600"
                    >
                      {a.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">{a.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">{a.hint}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function CryptoSummary() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Object.entries(CRYPTO_PRICES).map(([symbol, price]) => (
        <div key={symbol} className="rounded-lg border border-ink-100 bg-ink-50 p-3">
          <p className="text-xs font-medium text-ink-600">{symbol}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900">${price.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function LendingSummary() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-200 bg-ink-50 p-4">
      <div>
        <p className="font-medium text-ink-900">Business Lending</p>
        <p className="text-xs text-ink-500">Apply for working capital &amp; track loan status</p>
      </div>
      <Link
        href="/neobank/lending"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View lending →
      </Link>
    </div>
  );
}