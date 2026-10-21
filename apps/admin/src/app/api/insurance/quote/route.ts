import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * POST /api/insurance/quote - Get an insurance quote.
 *
 * Split out of `/api/insurance`, where it had been exported as a second `POST`
 * named `POSTQuote`. A route file may only export the standard HTTP verbs, so
 * the stray named export failed Next's generated type check and was never
 * routed anyway. Here it is the canonical `POST` for this path.
 */
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { type } = await req.json();
    const premiums: Record<string, number> = {
      health: 45,
      auto: 80,
      travel: 12,
      device: 8,
    };
    const monthly = premiums[type] ?? 25;

    const CRYPTO_PRICES = { BTC: 68500, ETH: 3500, SOL: 150, USDT: 1.0, USDC: 1.0 };

    return NextResponse.json({
      monthly,
      annual: +(monthly * 12).toFixed(2),
      crypto: {
        USDT: +(monthly * 1.0).toFixed(2),
        USDC: +(monthly * 1.0).toFixed(2),
        ETH: +(monthly / CRYPTO_PRICES.ETH).toFixed(6),
        BTC: +(monthly / CRYPTO_PRICES.BTC).toFixed(8),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
