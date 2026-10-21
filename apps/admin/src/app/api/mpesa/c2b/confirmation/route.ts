import { prisma } from "@kora/database";
import { NextResponse } from "next/server";
import { findC2bSme } from "@/lib/mpesa-c2b";
import { parseC2bPayload } from "@/lib/mpesa-c2b-payload";
import { verifyC2bSignature, C2bSignedContentError } from "@/lib/mpesa-c2b-verify";

type C2BPayload = {
  TransTime?: unknown;
};

/**
 * Daraja signs the C2B confirmation with HMAC-SHA256 (the Mpesa-C256-Hmac
 * header). Verification is disabled by default and only enforced when
 * `MPESA_C2B_VERIFY_SIGNATURES=true` and `MPESA_PASSKEY` is present, so an
 * unregistered checkout keeps behaving exactly as before. When enforced and
 * the signature is invalid, this returns a non-zero result so Daraja retries.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as C2BPayload | null;
  const payload = parseC2bPayload(body);
  if (!payload) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payment details." },
    );
  }

  try {
    verifyC2bSignature(payload, request.headers);
  } catch (error) {
    if (error instanceof C2bSignedContentError) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid signature" });
    }
    throw error;
  }
  const smeId = await findC2bSme(payload.shortcode);
  if (!smeId) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Business shortcode is not registered." },
    );
  }

  const transactionTime =
    typeof body?.TransTime === "string" && /^\d{14}$/.test(body.TransTime)
      ? body.TransTime
      : null;
  const transaction = await prisma.transaction.upsert({
    where: { reference: `C2B-${payload.transactionId}` },
    update: {},
    create: {
      reference: `C2B-${payload.transactionId}`,
      type: "MPESA_C2B_UNRECONCILED",
      description: "C2B payment received; manual reconciliation required",
      accountCode: "MPESA_C2B_UNRECONCILED",
      amount: payload.amount,
      currency: "KES",
      smeId,
      simulated: false,
      metadata: {
        status: "RECEIVED_UNRECONCILED",
        billReference: payload.billReference || null,
        transactionTime,
      },
    },
    select: { type: true, amount: true, smeId: true },
  });
  if (
    transaction.type !== "MPESA_C2B_UNRECONCILED" ||
    transaction.smeId !== smeId ||
    !transaction.amount.equals(payload.amount)
  ) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Receipt conflicts with an existing payment." },
    );
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
