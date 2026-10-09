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

export default async function CryptoPage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's crypto wallets
  const wallets = await prisma.cryptoWallet.findMany({
    where: { userId: user.id },
  });
  const total = wallets.reduce(
    (sum, w) => sum + parseFloat(w.balance.toString()),
    0,
  );
  const wallet = { wallets, balance: total.toFixed(2), currency: "USD" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Crypto Wallets</h2>
        <p className="mt-1 text-sm text-ink-500">Total Balance: ${Number(wallet.balance || 0).toFixed(2)} USD</p>
      </div>

      {wallets.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-ink-500">No crypto assets yet. Start depositing to build your portfolio.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w: any) => (
            <Card key={w.symbol} title={w.symbol}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Symbol</span>
                  <span className="text-sm font-medium text-ink-900">{w.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Balance</span>
                  <span className="text-lg font-semibold text-ink-900">{w.balance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Value (USD)</span>
                  <span className="text-sm font-medium text-ink-900">
                    ${(Number(w.balance) * (CRYPTO_PRICES[w.symbol] || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/neobank/crypto/deposit"
          className="rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
        >
          Deposit Crypto
        </a>
        <a
          href="/neobank/crypto/withdraw"
          className="rounded-md border border-brand-600 bg-white px-4 py-2 text-center text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          Withdraw Crypto
        </a>
      </div>
    </div>
  );
}