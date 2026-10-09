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

export default async function InvestmentsPage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's investments
  const portfolio = await prisma.investment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const plan = (user.planTier ?? "FREE").toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Investment Portfolio</h2>
        <p className="mt-1 text-sm text-ink-500">Plan: <strong className="text-brand-600">{plan.toUpperCase()}</strong></p>
      </div>

      {portfolio.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-ink-500">Your portfolio is empty. Start investing today!</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((asset: any) => (
            <Card key={asset.id} title={asset.symbol}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Name</span>
                  <span className="text-sm font-medium text-ink-900">{asset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Quantity</span>
                  <span className="text-sm font-medium text-ink-900">{Number(asset.quantity).toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Purchase Value</span>
                  <span className="text-sm font-medium text-ink-900">
                    ${Number(asset.quantity) * Number(asset.averagePrice)}
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
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/neobank/investments/trade"
          className="rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
        >
          Trade Assets
        </a>
        <a
          href="/plans"
          className="rounded-md border border-brand-600 bg-white px-4 py-2 text-center text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          Upgrade Plan
        </a>
      </div>
    </div>
  );
}