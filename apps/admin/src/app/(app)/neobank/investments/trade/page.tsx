import { Card } from "@/components/ui";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";

// Mock crypto prices
const CRYPTO_PRICES: Record<string, number> = {
  BTC: 68500,
  ETH: 3500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
};

export default async function InvestmentsTradePage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's portfolio
  const portfolio = await prisma.investment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const plan = (user.planTier ?? "FREE").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Trade Assets</h2>
        <p className="mt-1 text-sm text-ink-500">
          Buy and sell crypto assets on the Kora exchange
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(CRYPTO_PRICES).map(([symbol, price]) => (
          <Card key={symbol} title={symbol}>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-ink-500">Price (USD)</span>
                <span className="text-sm font-medium text-ink-900">
                  ${price.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-ink-500">24h Change</span>
                <span className="text-sm font-medium text-emerald-600">+2.4%</span>
              </div>
            </div>
            <button
              onClick={() => alert(`Trade functionality for ${symbol} coming soon.`)}
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={plan === "free"}
            >
              {plan === "free" ? "Upgrade to trade" : "Trade"}
            </button>
          </Card>
        ))}
      </div>

      {portfolio.length > 0 && (
        <Card title="Your Portfolio" hint="Current holdings">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portfolio.map((asset: any) => (
              <Card key={asset.id} title={asset.symbol}>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-ink-500">Quantity</span>
                    <span className="text-sm font-medium text-ink-900">
                      {Number(asset.quantity).toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-ink-500">Current Value</span>
                    <span className="text-sm font-medium text-ink-900">
                      ${Number(asset.quantity) * (CRYPTO_PRICES[asset.symbol] || 0)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/neobank/investments"
          className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Back to portfolio
        </a>
        <a
          href="/plans"
          className="rounded-md border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          Upgrade Plan
        </a>
      </div>
    </div>
  );
}