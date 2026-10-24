import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

// Mock crypto prices
const CRYPTO_PRICES: Record<string, number> = {
  BTC: 68500,
  ETH: 3500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
};

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
      "Unlimited bank accounts",
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

// POST /api/crypto/deposit - Deposit crypto
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { symbol, amount } = await req.json();
    if (!symbol || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Invalid symbol or amount" }, { status: 400 });
    }

    const asset = String(symbol).toUpperCase();
    const gross = parseFloat(amount);
    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    const plan = getPlan((user as any)?.plan);

    const fee = calculateFee(gross, plan.cryptoFeePercent);
    const net = +(gross - fee).toFixed(8);

    // Upsert the wallet
    const existingWallet = await prisma.cryptoWallet.findFirst({
      where: { userId: auth.user.id, symbol: asset },
    });

    let wallet;
    if (existingWallet) {
      const newBal = (parseFloat(existingWallet.balance.toString()) + net).toFixed(8);
      wallet = await prisma.cryptoWallet.update({
        where: { id: existingWallet.id },
        data: { balance: newBal },
      });
    } else {
      wallet = await prisma.cryptoWallet.create({
        data: { userId: auth.user.id, symbol: asset, balance: net.toFixed(8) },
      });
    }

    return NextResponse.json({
      success: true,
      wallet,
      txHash: `deposit_${Date.now()}`,
      gross: gross.toFixed(8),
      fee: fee.toFixed(8),
      feePercent: plan.cryptoFeePercent,
      net: net.toFixed(8),
      feeWallet: FEE_WALLETS[chainForAsset(asset)],
      depositWallet: DEPOSIT_WALLETS[chainForAsset(asset)],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}