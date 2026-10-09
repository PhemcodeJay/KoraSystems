import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";
import { Card } from "@/components/ui";

// Mock crypto prices for display
const CRYPTO_PRICES: Record<string, number> = {
  BTC: 68500,
  ETH: 3500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
};

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "KES" }).format(Number(amount));
}

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

  // For a real implementation, we'd get the user from session
  // Here we use a simplified approach for demonstration
  const accounts = []; // Would be fetched from API

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">NeoBank Dashboard</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Banking, Crypto, Cards, Investments & Insurance
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/neobank/accounts"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Bank Accounts</p>
          <p className="mt-0.5 text-xs text-ink-500">Checking, Savings, Loans</p>
        </Link>
        <Link
          href="/neobank/crypto"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Crypto Wallets</p>
          <p className="mt-0.5 text-xs text-ink-500">USDT, USDC, BTC, ETH, SOL</p>
        </Link>
        <Link
          href="/neobank/cards"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Cards</p>
          <p className="mt-0.5 text-xs text-ink-500">Physical & Virtual cards</p>
        </Link>
        <Link
          href="/neobank/investments"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Investments</p>
          <p className="mt-0.5 text-xs text-ink-500">Crypto portfolio</p>
        </Link>
      </div>

      {/* Bank Accounts Summary */}
      <Card title="Bank Accounts">
        <p className="text-sm text-ink-500">Connecting to NeoBank service...</p>
      </Card>

      {/* Crypto Summary */}
      <Card title="Crypto Holdings">
        <CryptoSummary />
      </Card>

      {/* Available Services */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/neobank/insurance"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Insurance Marketplace</p>
          <p className="mt-0.5 text-xs text-ink-500">Health, Auto, Travel, Device</p>
        </Link>
        <Link
          href="/plans"
          className="rounded-lg border border-ink-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-900">Upgrade Plan</p>
          <p className="mt-0.5 text-xs text-ink-500">Access premium features</p>
        </Link>
      </div>
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