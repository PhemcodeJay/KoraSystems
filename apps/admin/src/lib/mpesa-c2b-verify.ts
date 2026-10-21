/**
 * M-Pesa C2B signature verification.
 *
 * Daraja signs the C2B (Customer-to-Business) validation/confirmation response
 * with HMAC-SHA256 using the merchant's `MPESA_PASSKEY`. The server receives
 * this as the `Mpesa-C256-Hmac` request header (with a `Hash` query/body
 * parameter as a fallback).
 *
 *     signature = Base64( HMAC-SHA256( stringToBeSigned, MPESA_PASSKEY ) )
 *
 * `stringToBeSigned` is the ':'-joined concatenation of the fields, in the
 * exact order Daraja returns them in the C2B response:
 *
 *   OriginatorIdentifier : PassKey : MsgId : Amount : MpesaReceiptNumber :
 *   PhoneNumber : Result : ResultCode : ResultDesc : TransactionID :
 *   COMMAND_ID : SenderIdentifier : Address : Identifier : IdentifierType :
 *   InternationalSenderIdentifier : InternationalIdentifierType :
 *   Fare : Comment : AdminCommission : SystemTime :
 *   ThirdPartyTransactionID : OriginatingRoute : CarriageReason :
 *   AuthId : MapRsp
 *
 * Verification is DISABLED by default (feature flag
 * `MPESA_C2B_VERIFY_SIGNATURES` = false, and unreadable when
 * `MPESA_PASSKEY` is absent), so an unregistered checkout keeps behaving
 * exactly as before. When enabled with a key present, a response whose
 * signature does not match is rejected with a non-zero code so Daraja retries
 * instead of trusting a forged callback.
 *
 * NOTE: field order/separators must match the running Daraja API version.
 * Adjust the `C2B_SIGNATURE_FIELDS` table below if your validation responses
 * disagree — it is a one-line edit.
 */

import { createHmac } from "node:crypto";

/** Field order for the C2B `Hash` (Mpesa-C256-Hmac). Separator is ':' */
export const C2B_SIGNATURE_FIELDS = [
  "OriginatorIdentifier",
  "PassKey",
  "MsgId",
  "Amount",
  "MpesaReceiptNumber",
  "PhoneNumber",
  "Result",
  "ResultCode",
  "ResultDesc",
  "TransactionID",
  "COMMAND_ID",
  "SenderIdentifier",
  "Address",
  "Identifier",
  "IdentifierType",
  "InternationalSenderIdentifier",
  "InternationalIdentifierType",
  "Fare",
  "Comment",
  "AdminCommission",
  "SystemTime",
  "ThirdPartyTransactionID",
  "OriginatingRoute",
  "CarriageReason",
  "AuthId",
  "MapRsp",
] as const;

/** How to read the raw multi-value response body (URL-encoded vs JSON). */
export type C2bRawBody = Record<string, string | string[] | undefined>;

/** Extract a single string field from a C2B response body. */
export function c2bField(body: C2bRawBody, key: (typeof C2B_SIGNATURE_FIELDS)[number]): string {
  const value = body[key];
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return "";
}

/** Build `stringToBeSigned` exactly as Daraja specifies. */
export function buildC2bStringToSign(body: C2bRawBody): string {
  return C2B_SIGNATURE_FIELDS.map((field) => c2bField(body, field)).join(":");
}

/** Compute the expected signature given a passkey. */
export function computeC2bSignature(passkey: string, stringToSign: string): string {
  return createHmac("sha256", passkey).update(stringToSign).digest("base64");
}

/**
 * Resolve the passkey. Returns null when `MPESA_PASSKEY` is missing or blank
 * — the caller should then skip verification.
 */
export function getMpesaPasskey(): string | null {
  const passkey = process.env.MPESA_PASSKEY;
  if (!passkey) return null;
  return passkey.trim();
}

/**
 * Opt-in feature flag. Defaults to false so an unregistered checkout keeps
 * behaving exactly as before until explicitly enabled for a registered
 * merchant.
 */
export function shouldVerifyC2BSignature(): boolean {
  const raw = process.env.MPESA_C2B_VERIFY_SIGNATURES;
  if (raw === undefined || raw === "") return false;
  return raw.toLowerCase() === "true";
}

/**
 * Verify the C2B response signature.
 *
 * `body` is the already-parsed C2B response object. `requestHeaders` is the
 * incoming request's Headers instance (route handlers have this).
 *
 * Returns true when the signature matches (or verification is disabled / no
 * passkey present). Throws an error when verification is enabled but the
 * signature is invalid, so the caller can answer Daraja with a non-zero code.
 */
export function verifyC2bSignature(body: C2bRawBody, requestHeaders: Headers): boolean {
  if (!shouldVerifyC2BSignature()) return true;

  const passkey = getMpesaPasskey();
  if (!passkey) return true;

  const stringToSign = buildC2bStringToSign(body);
  const expected = computeC2bSignature(passkey, stringToSign);

  // Read the signature from the request header (Daraja sends it both as a
  // `Hash` query/body parameter and as the `Mpesa-C256-Hmac` header).
  const rawHeader = requestHeaders.get("Mpesa-C256-Hmac") ?? "";
  const headerSignature = rawHeader.trim();
  const bodySignature = c2bField(body as C2bRawBody, "Hash") as string;

  const supplied = headerSignature || bodySignature;
  if (!supplied) return true; // nothing to verify against

  // Timing-safe comparison avoids leaking where the mismatch occurs.
  if (expected.length !== supplied.length || !cryptoEqual(expected, supplied)) {
    throw new C2bSignedContentError(
      `C2B signature mismatch — expected ${expected.length} base64 chars, got ${supplied.length}.`,
    );
  }

  return true;
}

/** Timing-safe string comparison (avoids timing side-channels). */
function cryptoEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/** Thrown when an enabled, keyed C2B response fails verification. */
export class C2bSignedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "C2bSignedContentError";
  }
}
