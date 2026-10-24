import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth/guards";
import { NextResponse } from "next/server";

/**
 * M-Pesa STK push — collect money from a customer's phone.
 *
 * ── Why this simulates unless credentials are present ───────────────────────
 * Daraja rejects any request signed with placeholder credentials, so a demo or
 * a review machine cannot make a real call. Rather than failing with an opaque
 * upstream error, an unconfigured environment returns a well-formed simulated
 * response and says so plainly. This mirrors `DISBURSEMENT_PROVIDER=simulated`,
 * which the rest of the platform already uses for exactly this reason.
 *
 * The `simulated` flag is written onto the Transaction either way, so a
 * simulated collection can never be mistaken for money that moved.
 */
const BASE: Record<string, string> = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

/**
 * Public URL Daraja should post the STK result to.
 *
 * Prefers `MPESA_CALLBACK_URL` (the canonical name in `.env.example`) when set,
 * else `MPESA_RESULT_URL`, else `NEXT_PUBLIC_APP_URL`. Returns null when nothing
 * is configured, so the caller can simulate rather than hand Daraja a
 * malformed URL.
 */
function callbackUrl(): string | null {
  const direct = process.env.MPESA_CALLBACK_URL || process.env.MPESA_RESULT_URL;
  if (direct) return direct;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/api/mpesa/callback`;
}

const configured = () =>
  !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY &&
    // Either a Paybill shortcode OR a Buy Goods Till number must be present —
    // the platform owner accepts Buy Goods (Till) for customer payments, while
    // platform subscriptions use the Paybill. Both are valid Daraja shortcodes.
    (process.env.MPESA_SHORTCODE || process.env.MPESA_TILL_NUMBER) &&
    callbackUrl()
  );

/** Kenyan MSISDN: 07…/01… locally, +2547…/+2541… internationally. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.startsWith("254") ? digits.slice(3) : digits;
  if (/^0(7|1)\d{8}$/.test(local)) return `254${local.slice(1)}`;
  if (/^(7|1)\d{8}$/.test(local)) return `254${local}`;
  return null;
}

export async function POST(request: Request) {
  const auth = await withAuth("SME", "CUSTOMER", "SUPPLIER", "ADMIN");
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    amount?: number | string;
    accountCode?: string;
    description?: string;
    reference?: string;
  } | null;

  if (!body?.phone) {
    return NextResponse.json({ error: "A customer phone number is required." }, { status: 400 });
  }

  const phone = normalisePhone(String(body.phone));
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid Kenyan number, e.g. 0712345678 or +254712345678." },
      { status: 400 },
    );
  }

  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }

  // `.env` calls this `MPESA_ENVIRONMENT`; `MPESA_ENV` is kept as a fallback
  // so either spelling works.
  const env = process.env.MPESA_ENVIRONMENT ?? process.env.MPESA_ENV ?? "sandbox";
  const base = BASE[env] ?? BASE.sandbox;
  const accountCode = body.accountCode?.trim() || "PENDING";
  const reference = body.reference?.trim() || `STK-${Date.now()}`;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

  if (!configured()) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      checkoutRequestId: `SIM-${reference}`,
      phone,
      amount,
      message: !callbackUrl()
        ? "No public callback URL is configured, so this was simulated. A real M-Pesa payment could not report its result back and would hang. Set MPESA_CALLBACK_URL (or NEXT_PUBLIC_APP_URL). No money moved."
        : "M-Pesa credentials are not configured, so this was simulated. No money moved and the customer's phone was not prompted.",
    });
  }

  // ── Real Daraja STK push ──────────────────────────────────────────────────
  // Open the payment *before* prompting the phone. The callback finds it by
  // `AccountReference`, which is this same `reference`, so without this row
  // there is nothing for it to settle and every real payment would hang
  // pending forever. `metadata.status` is the state the callback reads.
  await prisma.transaction.upsert({
    where: { reference },
    update: { metadata: { status: "PENDING", phone, amount } },
    create: {
      reference,
      type: "STK_COLLECTION",
      description: body.description?.trim() || `Payment to ${auth.user.fullName}`,
      accountCode,
      amount,
      currency: "KES",
      // Real money is being requested, so this is not demo data. The
      // simulated branch above returns before reaching here and writes
      // nothing at all, which keeps simulated and real unambiguous.
      simulated: false,
      metadata: { status: "PENDING", phone, amount },
    },
  });

  try {
    const tokenRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64")}` },
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "M-Pesa rejected the credentials." }, { status: 502 });
    }
    const { access_token: token } = (await tokenRes.json()) as { access_token: string };

    const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");

    // Buy Goods (Till) vs Paybill — the platform owner accepts Buy Goods for
    // customer payments; platform subscriptions use the Paybill shortcode.
    const isBuyGoods = !!process.env.MPESA_TILL_NUMBER;
    const shortcode = isBuyGoods ? process.env.MPESA_TILL_NUMBER : process.env.MPESA_SHORTCODE;

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: isBuyGoods ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl(),
        AccountReference: isBuyGoods ? "" : reference,
        TransactionDesc: body.description?.trim() || `Payment to ${auth.user.fullName}`,
      }),
    });

    const result = (await stkRes.json()) as {
      CheckoutRequestID?: string;
      CustomerMessage?: string;
      ResponseCode?: number;
    };

    // Daraja returns HTTP 200 even for business-level rejections, so the
    // ResponseCode is what actually decides success.
    if (!stkRes.ok || result.ResponseCode !== 0) {
      // Close the row opened above. Leaving it PENDING would let the callback
      // later "settle" a payment Daraja already refused.
      await prisma.transaction.update({
        where: { reference },
        data: {
          metadata: { status: "FAILED", phone, amount, responseCode: result.ResponseCode ?? -1 },
        },
      });
      return NextResponse.json(
        {
          error: result.CustomerMessage ?? "M-Pesa declined the request.",
          responseCode: result.ResponseCode,
        },
        { status: 502 },
      );
    }

    // Record the handle the callback will echo back, so the two sides can be
    // correlated when reconciling instead of matching on reference alone.
    await prisma.transaction.update({
      where: { reference },
      data: {
        metadata: { status: "PENDING", phone, amount, checkoutRequestId: result.CheckoutRequestID },
      },
    });

    return NextResponse.json({
      ok: true,
      simulated: false,
      checkoutRequestId: result.CheckoutRequestID,
      phone,
      amount,
      message: "Prompt sent. The payment completes asynchronously via the callback.",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach M-Pesa." }, { status: 502 });
  }
}