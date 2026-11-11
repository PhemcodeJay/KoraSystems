"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Card } from "@/components/ui";
import { cachedFetch, clearCache } from "@/lib/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-ink-100 ${className}`} />;
}

function SkeletonLine({ width }: { width: string }) {
  return <div aria-hidden="true" className="h-4 animate-pulse rounded bg-ink-100" style={{ width }} />;
}

function LoadingSpinner({ size, className = "" }: { size: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`inline-block animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const CRYPTO_PRICES: Record<string, number> = {
  BTC: 68500,
  ETH: 3500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
};

const CHAIN_LABELS: Record<string, string> = {
  USDT: "TRC20 (TRON)",
  USDC: "TRC20 (TRON)",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
};

const chainForAsset = (asset: string): "tron" | "solana" =>
  asset === "USDT" || asset === "USDC" ? "tron" : "solana";

const FEE_WALLETS: Record<string, string> = {
  tron: process.env.NEXT_PUBLIC_TRON_FEE_WALLET ?? "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  solana: process.env.NEXT_PUBLIC_SOLANA_FEE_WALLET ?? "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
};
const DEPOSIT_WALLETS: Record<string, string> = {
  tron: process.env.NEXT_PUBLIC_TRON_DEPOSIT_WALLET ?? "",
  solana: process.env.NEXT_PUBLIC_SOLANA_DEPOSIT_WALLET ?? "",
};

type DepositResult = {
  txHash: string;
  gross: string;
  fee: string;
  net: string;
  symbol: string;
  address: string;
  depositWallet: string;
};

/**
 * Debounce helper — keeps input changes from re-rendering on every keystroke.
 */
function useDebounceValue(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CryptoDepositPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("USDT");
  const [amount, setAmount] = useState("");
  const debouncedAmount = useDebounceValue(amount, 150);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<DepositResult | null>(null);

  const chain = chainForAsset(symbol);
  const feeWallet = FEE_WALLETS[chain];
  const depositWallet = DEPOSIT_WALLETS[chain];

  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setDone(null);
      setLoading(true);

      try {
        const res = await cachedFetch("/api/crypto/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, amount: debouncedAmount }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          setError(json?.error ?? "Deposit failed. Please try again.");
          return;
        }

        setDone({
          txHash: json.txHash,
          gross: json.gross,
          fee: json.fee,
          net: json.net,
          symbol: json.wallet?.symbol ?? symbol,
          address: json.depositWallet ?? depositWallet,
          depositWallet: json.depositWallet ?? depositWallet,
        });

        setAmount("");
        clearCache("/api/crypto/balance");
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [debouncedAmount, depositWallet, symbol]
  );

  const handleCopy = useCallback(() => {
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    navigator.clipboard.writeText(depositWallet).catch(() => {});
    setCopied(true);
    copyTimeout.current = setTimeout(() => setCopied(false), 1500);
  }, [depositWallet]);

  const showSkeleton = loading && !done;

  return (
    <div className="space-y-8">
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-gray-50 rounded-lg p-4 h-full border">
                <img src="/placeholder-screenshot-1.jpg" alt="Product Screenshot 1" className="w-full h-48 object-cover rounded-md" />
                <p className="mt-2 text-sm text-gray-600">Feature Overview</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 h-full border">
                <img src="/placeholder-screenshot-2.jpg" alt="Product Screenshot 2" className="w-full h-48 object-cover rounded-md" />
                <p className="mt-2 text-sm text-gray-600">User Dashboard</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 h-full border">
                <img src="/placeholder-screenshot-3.jpg" alt="Product Screenshot 3" className="w-full h-48 object-cover rounded-md" />
                <p className="mt-2 text-sm text-gray-600">Transaction Flow</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Deposit Crypto</h2>
          <p className="mt-1 text-sm text-ink-500">
            Send USDT (TRC20) to your Kora crypto wallet. Funds are credited after a plan-based fee is deducted.
          </p>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 text-ink-900">
            <p className="text-sm">{error}</p>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Asset</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              disabled={loading}
              className={clsx(
                "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm",
                loading ? "opacity-60 cursor-not-allowed" : ""
              )}
            >
              <option value="USDT">USDT — TRC20 (TRON)</option>
              <option value="USDC">USDC — TRC20 (TRON)</option>
              <option value="BTC">BTC — Bitcoin</option>
              <option value="ETH">ETH — Ethereum</option>
              <option value="SOL">SOL — Solana</option>
            </select>
            <p className="mt-1 text-xs text-ink-500">
              Deposit network: <span className="font-medium">{CHAIN_LABELS[symbol]}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">Amount ({symbol})</label>
            <input
              type="number"
              step="any"
              min="0"
              disabled={loading}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={clsx(
                "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm",
                loading ? "opacity-60 cursor-not-allowed" : ""
              )}
              placeholder="e.g. 50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className={clsx(
              "w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-all",
              loading ? "bg-brand-400 cursor-not-allowed" : "bg-brand-600 hover:bg-brand-700"
            )}
          >
            {loading ? (
              <>
                <LoadingSpinner size={16} className="mr-2" />
                Depositing…
              </>
            ) : (
              "Deposit Crypto"
            )}
          </button>
        </form>

        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-ink-900">Deposit Address</h3>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
              {chain.toUpperCase()} address
            </span>
            <span className="ml-auto text-xs text-ink-400">Send {symbol} only</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={depositWallet}
              className="flex-1 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-sm text-ink-900"
            />
            <button
              onClick={handleCopy}
              disabled={loading}
              className={clsx(
                "rounded-md border border-ink-200 px-3 py-2 text-sm transition-all",
                loading
                  ? "cursor-not-allowed border-ink-200 text-ink-400 opacity-60"
                  : "text-ink-700 hover:bg-ink-50"
              )}
              title="Copy address"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Sending to this address credits your {symbol} wallet after the applicable network fee.
          </p>
        </div>

        {done && (
          <Card
            title="Deposit queued"
            hint={`Tx: ${done.txHash}`}
            className="border-green-200 bg-green-50 text-ink-900"
          >
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink-500">Gross</dt>
              <dd className="text-ink-900">{done.gross} {done.symbol}</dd>
              <dt className="text-ink-500">Fee</dt>
              <dd className="text-ink-900">{done.fee} {done.symbol}</dd>
              <dt className="text-ink-500">Net credited</dt>
              <dd className="font-semibold text-ink-900">{done.net} {done.symbol}</dd>
              <dt className="text-ink-500">Send to</dt>
              <dd className="col-span-2 break-all font-mono text-xs text-ink-900">
                {done.address}
              </dd>
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Your deposit is being processed. Refresh the crypto page to see the updated balance.
            </p>
            <button
              onClick={() => router.push("/neobank/crypto")}
              className="mt-4 inline rounded-md border border-brand-600 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
            >
              Back to wallets
            </button>
          </Card>
        )}

        {showSkeleton && (
          <div className="space-y-4">
            <SkeletonLine width="40%" />
            <SkeletonLine width="70%" />
            <Skeleton className="h-48" />
          </div>
        )}
      </div>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-100 rounded-xl p-8 text-center">
              <iframe
                width="560"
                height="315"
                src="https://www.loom.com/embed/placeholder-video-id"
                title="Kora Systems Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="mb-4 w-full rounded-md"
              />
              <h3 className="mb-2 text-xl font-medium text-gray-800">See Kora in 2 minutes</h3>
              <p className="text-gray-500">Watch a quick demo of our platform features</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <blockquote className="border-l-4 border-green-500 pl-6 py-8 text-2xl font-medium text-gray-800">
              “Kora Systems has transformed our payment processing. The integration was seamless and the support team was incredibly responsive.”
            </blockquote>
            <div className="mt-6">
              <div className="flex items-center space-x-3">
                <img src="/placeholder-team-1.jpg" alt="Team Member" className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <p className="font-medium">John Doe</p>
                  <p className="text-sm text-gray-500">Pilot User</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-white p-6">
                <img src="/placeholder-team-2.jpg" alt="Team Member" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
                <h4 className="text-lg font-medium">Jane Smith</h4>
                <p className="text-sm text-gray-500">Co-founder & CEO</p>
                <p className="mt-2 text-xs text-gray-400">Leads product strategy and vision</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <img src="/placeholder-team-3.jpg" alt="Team Member" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
                <h4 className="text-lg font-medium">Alex Johnson</h4>
                <p className="text-sm text-gray-500">Lead Engineer</p>
                <p className="mt-2 text-xs text-gray-400">Builds the core platform</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <img src="/placeholder-team-4.jpg" alt="Team Member" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
                <h4 className="text-lg font-medium">Maria Garcia</h4>
                <p className="text-sm text-gray-500">Growth Manager</p>
                <p className="mt-2 text-xs text-gray-400">Drives user acquisition</p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <img src="/placeholder-team-5.jpg" alt="Team Member" className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />
                <h4 className="text-lg font-medium">Robert Chen</h4>
                <p className="text-sm text-gray-500">Customer Success</p>
                <p className="mt-2 text-xs text-gray-400">Ensures customer satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="mb-4 border-b pb-4">
              <h3 className="text-xl font-medium text-gray-800">Latest from the Blog</h3>
            </div>
            <article className="group transition-colors hover:text-gray-800">
              <h4 className="title3 line-clamp-2 font-medium">
                <a href="#" className="hover underline">
                  Building Trust in Digital Payments: Our Journey So Far
                </a>
              </h4>
              <p className="mt-1 text-sm text-gray-500">November 2024 · 5 min read</p>
            </article>
            <article className="group transition-colors hover:text-gray-800">
              <h4 className="title3 line-clamp-2 font-medium">
                <a href="#" className="hover underline">
                  How Kora Systems is Revolutionizing Cross-Border Transactions
                </a>
              </h4>
              <p className="mt-1 text-sm text-gray-500">October 2024 · 7 min read</p>
            </article>
            <article className="group transition-colors hover:text-gray-800">
              <h4 className="title3 line-clamp-2 font-medium">
                <a href="#" className="hover underline">
                  5 Key Features Every Crypto Payment Platform Should Have
                </a>
              </h4>
              <p className="mt-1 text-sm text-gray-500">September 2024 · 4 min read</p>
            </article>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-md">
            <form className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Your name"
                  className="w-full rounded border px-3 py-2 text-gray-700 shadow appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  className="w-full rounded border px-3 py-2 text-gray-700 shadow appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Message</label>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Your message here"
                  className="w-full resize-none rounded border px-3 py-2 text-gray-700 shadow appearance-none focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 font-bold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

