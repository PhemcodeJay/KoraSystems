import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";
import { TIERS } from "@kora/auth/entitlements";

// Live crypto prices fetched from CoinGecko API
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

const ASSET_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
  USDC: "usd-coin",
};

async function fetchLiveCryptoPrices(): Promise<Record<string, number>> {
  try {
    const ids = Object.values(ASSET_TO_COINGECKO).join(",");
    const response = await fetch(
      `${COINGECKO_API_URL}?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    const data = await response.json();
    const prices: Record<string, number> = {};
    for (const [symbol, id] of Object.entries(ASSET_TO_COINGECKO)) {
      prices[symbol] = data[id]?.usd ?? 0;
    }
    return prices;
  } catch (error) {
    console.error("Failed to fetch live crypto prices:", error);
    // Fallback to last known prices
    return {
      BTC: 0,
      ETH: 0,
      SOL: 0,
      USDT: 1.0,
      USDC: 1.0,
    };
  }
}

const FEE_WALLETS = {
  tron: process.env.TRON_FEE_WALLET || "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  solana: process.env.SOLANA_FEE_WALLET || "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
};
const DEPOSIT_WALLETS = {
  tron: process.env.TRON_DEPOSIT_WALLET || "",
  solana: process.env.SOLANA_DEPOSIT_WALLET || "",
};

const INVESTMENT_FEE_PERCENT = Number(process.env.INVESTMENT_FEE_PERCENT ?? 5);
const MIN_FEE = Number(process.env.MIN_FEE_USDT ?? 0.01);

type PlanId = "free" | "standard" | "metal";

interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  cryptoFeePercent: number;
  investmentFeePercent: number;
  investmentAccess: boolean;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    cryptoFeePercent: 5,
    investmentFeePercent: INVESTMENT_FEE_PERCENT,
    investmentAccess: true,
    features: [
      "1 bank account",
      "1 virtual card",
      "Crypto deposits & withdrawals (TRC-20 / Solana)",
      "Investment system access",
      "Email support",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 9.99,
    cryptoFeePercent: 2,
    investmentFeePercent: INVESTMENT_FEE_PERCENT,
    investmentAccess: true,
    features: [
      "Up to 15 bank accounts",
      "Up to 5 virtual cards",
      "Reduced crypto fees (2%)",
      "USDT virtual cards",
      "Investment system access",
      "Priority support",
    ],
  },
  {
    id: "metal",
    name: "Metal",
    price: 19.99,
    cryptoFeePercent: 0.5,
    investmentFeePercent: INVESTMENT_FEE_PERCENT,
    investmentAccess: true,
    popular: true,
    features: [
      "Everything in Standard",
      "Lowest crypto fees (0.5%)",
      "Insurance marketplace",
      "Metal physical card",
      "Dedicated account manager",
    ],
  },
];

const getPlan = (id?: string | null): PlanDefinition =>
  PLANS.find(p => p.id === id) ?? PLANS[0];

const calculateFee = (amount: number, percent: number): number => {
  if (!percent || percent <= 0 || !isFinite(amount) || amount <= 0) return 0;
  return +Math.max((amount * percent) / 100, MIN_FEE).toFixed(8);
};

const chainForAsset = (asset: string): "tron" | "solana" =>
  asset === "USDT" || asset === "USDC" ? "tron" : "solana";

// GET /api/crypto/balance - Get total crypto balance
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const wallets = await prisma.cryptoWallet.findMany({
    where: auth.user.role === "ADMIN" ? {} : { userId: auth.user.id },
  });
  const totalBalance = wallets.reduce((sum, w) => sum + parseFloat(w.balance.toString()), 0);
  return NextResponse.json({
    wallet: {
      id: auth.user.id,
      balance: totalBalance.toFixed(2),
      currency: "USD",
      wallets,
    },
    feeWallets: FEE_WALLETS,
    depositWallets: DEPOSIT_WALLETS,
  });
}