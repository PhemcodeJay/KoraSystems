import { NextResponse } from "next/server";
import { findC2bSme } from "@/lib/mpesa-c2b";
import { parseC2bPayload } from "@/lib/mpesa-c2b-payload";
import { verifyC2bSignature, C2bSignedContentError } from "@/lib/mpesa-c2b-verify";

/**
 * Daraja signs the C2B validation response with HMAC-SHA256 (Mpesa-C256-Hmac).
 * Verification is disabled by default and only enforced when
 * `MPESA_C2B_VERIFY_SIGNATURES=true` and `MPESA_PASSKEY` is present. A failed
 * signature returns a non-zero result so Daraja retries rather than trusting a
 * forged callback.
 */
export async function POST(request: Request) {
  // The RAW body is what Daraja signed. The normalised payload below uses
  // different field names (`TransAmount` vs `Amount`), so verifying against it
  // would build the wrong `stringToBeSigned` and reject every legitimate
  // callback. Verify first, against the raw body.
  const raw = (await request.json().catch(() => null)) as Record<
    string,
    string | string[] | undefined
  > | null;

  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payment details." },
    );
  }

  try {
    verifyC2bSignature(raw, request.headers);
  } catch (error) {
    if (error instanceof C2bSignedContentError) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid signature" });
    }
    throw error;
  }

  const payload = parseC2bPayload(raw);
  if (!payload) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payment details." },
    );
  }

  const smeId = await findC2bSme(payload.shortcode);
  if (!smeId) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Business shortcode is not registered." },
    );
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
