import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

// Mock crypto prices
const CRYPTO_PRICES: Record<string, number> = {
  BTC: 68500,
  ETH: 3500,
  SOL: 150,
  USDT: 1.0,
  USDC: 1.0,
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

const FEE_WALLETS = {
  tron: process.env.TRON_FEE_WALLET || "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  solana: process.env.SOLANA_FEE_WALLET || "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
};

const chainForAsset = (asset: string): "tron" | "solana" =>
  asset === "USDT" || asset === "USDC" ? "tron" : "solana";

// GET /api/investments - Get user's investments
export async function GET() {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
  });

  const plan = getPlan((user as any)?.plan);
  const portfolio = await prisma.investment.findMany({
    where: auth.user.role === "ADMIN" ? {} : { userId: auth.user.id },
  });

  return NextResponse.json({ portfolio, plan: plan.id, planName: plan.name, investmentAccess: plan.investmentAccess });
}

// POST /api/investments/trade - Trade an investment
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { symbol, name, type, quantity, price, action } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    const plan = getPlan((user as any)?.plan);
    if (!plan.investmentAccess) {
      return NextResponse.json({ error: "Upgrade your plan to access the investment system" }, { status: 403 });
    }
    if (type && type !== "crypto") {
      return NextResponse.json({ error: "Only crypto assets are supported" }, { status: 400 });
    }
    if (!CRYPTO_PRICES[symbol]) {
      return NextResponse.json({ error: "Unsupported crypto asset" }, { status: 400 });
    }

    const unitPrice = CRYPTO_PRICES[symbol];
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const usdtWallet = await prisma.cryptoWallet.findFirst({
      where: { userId: auth.user.id, symbol: "USDT" },
    });
    // `balance` is a Prisma Decimal, not a string, so coerce explicitly.
    const usdtBalance = usdtWallet ? parseFloat(usdtWallet.balance.toString()) : 0;
    const tradeValue = +(qty * unitPrice).toFixed(2);

    const fee = calculateFee(tradeValue, plan.investmentFeePercent);

    const portfolio = await prisma.investment.findMany({
      where: { userId: auth.user.id },
    });
    const existing = portfolio.find((p: any) => p.symbol === symbol);

    if (action === "buy") {
      const total = +(tradeValue + fee).toFixed(2);
      if (usdtBalance < total) {
        return NextResponse.json({
          error: `Insufficient USDT balance. Need ${total} USDT`,
          required: total,
          balance: usdtBalance,
          fee,
        }, { status: 400 });
      }

      // Update USDT wallet
      const newBal = (usdtBalance - total).toFixed(8);
      await prisma.cryptoWallet.upsert({
        where: { userId_symbol: { userId: auth.user.id, symbol: "USDT" } },
        update: { balance: newBal },
        create: { userId: auth.user.id, symbol: "USDT", balance: newBal },
      });

      if (existing) {
        // `quantity` and `averagePrice` are Prisma Decimals, not strings.
        const newQty = (parseFloat(existing.quantity.toString()) + qty).toFixed(8);
        const newPrice = ((parseFloat(existing.averagePrice.toString()) * parseFloat(existing.quantity.toString()) + unitPrice * qty) / parseFloat(newQty)).toFixed(2);
        await prisma.investment.update({
          where: { id: existing.id },
          data: { quantity: newQty, averagePrice: newPrice },
        });
      } else {
        await prisma.investment.create({
          data: {
            userId: auth.user.id,
            symbol,
            name,
            type: "crypto",
            quantity: qty.toFixed(8),
            averagePrice: unitPrice.toFixed(2),
          },
        });
      }
    } else if (action === "sell") {
      if (!existing || parseFloat(existing.quantity.toString()) < qty) {
        return NextResponse.json({ error: "Insufficient quantity" }, { status: 400 });
      }
      const proceeds = +(tradeValue - fee).toFixed(2);
      const currentUSDT = await prisma.cryptoWallet.findFirst({
        where: { userId: auth.user.id, symbol: "USDT" },
      });
      const newBal = (parseFloat((currentUSDT?.balance ?? 0).toString()) + proceeds).toFixed(8);
      await prisma.cryptoWallet.upsert({
        where: { userId_symbol: { userId: auth.user.id, symbol: "USDT" } },
        update: { balance: newBal },
        create: { userId: auth.user.id, symbol: "USDT", balance: newBal },
      });
      const newQty = (parseFloat(existing.quantity.toString()) - qty).toFixed(8);
      await prisma.investment.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      tradeValue,
      fee: fee.toFixed(8),
      feePercent: plan.investmentFeePercent,
      feeWallet: FEE_WALLETS.tron,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}