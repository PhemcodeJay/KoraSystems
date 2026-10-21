"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Card } from "@/components/ui";
import { Skeleton, SkeletonLine, LoadingSpinner } from "@/components/skeleton";
import { cachedFetch, clearCache } from "@/lib/ui";

const CHAIN_LABELS: Record<string, string> = {
  USDT: "TRC20 (TRON)",
  USDC: "TRC20 (TRON)",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
};

const chainForAsset = (asset: string): "tron" | "solana" =>
  asset === "USDT" || asset === "USDC" ? "tron" : "solana";

type WithdrawResult = {
  txHash: string;
  gross: string;
  fee: string;
  total: string;
  symbol: string;
  address: string;
  balance: string;
};

function useDebounceValue(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CryptoWithdrawPage() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("USDT");
  const [amount, setAmount] = useState("");
  const debouncedAmount = useDebounceValue(amount, 150);
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<WithdrawResult | null>(null);

  const chain = chainForAsset(symbol);

  const balanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Balance fetch ─────────────────────────────────────────────
  // Only refetch when symbol actually changes (not on every render),
  // and use the client cache so repeated navigations are instant.
  useEffect(() => {
    if (balanceTimeout.current) clearTimeout(balanceTimeout.current);
    balanceTimeout.current = setTimeout(async () => {
      try {
        const res = await cachedFetch("/api/crypto/balance");
        const json = await res.json();
        const wallets = json?.wallet?.wallets ?? [];
        const w = wallets.find((x: any) => x.symbol === symbol);
        setBalance(w ? w.balance.toString() : "0");
      } catch {
        // Balance fetch is non-fatal; form still works.
      }
    }, 100);
    return () => {
      if (balanceTimeout.current) clearTimeout(balanceTimeout.current);
    };
  }, [symbol]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setDone(null);
      setLoading(true);

      try {
        const res = await cachedFetch("/api/crypto/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, amount: debouncedAmount, address }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          setError(json?.error ?? "Withdrawal failed. Please try again.");
          return;
        }

        setDone({
          txHash: json.txHash,
          gross: json.gross,
          fee: json.fee,
          total: json.total,
          symbol: json.symbol ?? symbol,
          address: json.address ?? address,
          balance: json.wallet?.balance ?? "",
        });

        setAmount("");
        setAddress("");
        clearCache("/api/crypto/balance");
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [symbol, debouncedAmount, address]
  );

  const showSkeleton = loading && !done;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink-900">Withdraw Crypto</h2>
        <p className="mt-1 text-sm text-ink-500">
          Send {symbol} from your Kora wallet to an external{" "}
          {CHAIN_LABELS[symbol]} address.
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 text-ink-900">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-900 mb-3">
          Available Balance
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-semibold tabular-nums text-ink-900">
            {balance ?? "—"}
          </span>
          <span className="text-sm font-medium text-ink-500">{symbol}</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Your withdrawable {symbol} balance on the {CHAIN_LABELS[symbol]}
          network.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">Asset</label>
          <select
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              }}
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
            Withdrawal network: <span className="font-medium">{CHAIN_LABELS[symbol]}</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">
            Amount ({symbol})
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className={clsx(
              "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm",
              loading ? "opacity-60 cursor-not-allowed" : ""
            )}
            placeholder="e.g. 25"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">
            Destination Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            className={clsx(
              "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm font-mono text-sm",
              loading ? "opacity-60 cursor-not-allowed" : ""
            )}
            placeholder="e.g. TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
            required
          />
          <p className="mt-1 text-xs text-ink-500">
            Double-check the address — crypto withdrawals cannot be reversed.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !amount || parseFloat(amount) <= 0 || !address}
          className={clsx(
            "w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-all",
            loading
              ? "bg-brand-400 cursor-not-allowed"
              : "bg-brand-600 hover:bg-brand-700"
          )}
        >
          {loading ? (
            <>
              <LoadingSpinner size={16} className="mr-2" />
              Withdrawing…
            </>
          ) : (
            "Withdraw Crypto"
          )}
        </button>
      </form>

      {done && (
        <Card
          title="Withdrawal queued"
          hint={`Tx: ${done.txHash}`}
          className="border-green-200 bg-green-50 text-ink-900"
        >
          <dl className="grid grid-cols-2 gap-2 text-sm mt-2">
            <dt className="text-ink-500">Gross</dt>
            <dd className="text-ink-900">{done.gross} {done.symbol}</dd>
            <dt className="text-ink-500">Fee</dt>
            <dd className="text-ink-900">{done.fee} {done.symbol}</dd>
            <dt className="text-ink-500">Total debited</dt>
            <dd className="text-ink-900 font-semibold">{done.total} {done.symbol}</dd>
            <dt className="text-ink-500">New balance</dt>
            <dd className="text-ink-900">{done.balance} {done.symbol}</dd>
            <dt className="text-ink-500">Sent to</dt>
            <dd className="col-span-2 text-ink-900 font-mono text-xs break-all">
              {done.address}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Funds are on their way to {done.address}. Refresh the crypto page to
            confirm the updated balance.
          </p>
          <button
            onClick={() => router.push("/neobank/crypto")}
            className="mt-4 inline rounded-md border border-brand-600 px-3 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            Back to wallets
          </button>
        </Card>
      )}

      {/* Skeleton placeholders so the layout doesn't jump while loading. */}
      {loading && !done && (
        <div className="space-y-4">
          <SkeletonLine width="40%" />
          <SkeletonLine width="70%" />
          <Skeleton className="h-48" />
        </div>
      )}
    </div>
  );
}








