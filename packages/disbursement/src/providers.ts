import { prisma } from "@kora/database";
import { loanDisbursementLegs, post } from "@kora/ledger";
import type { DisbursementProvider, DisbursementRequest, DisbursementResult } from "./types";

export const BLOCKED_REASON =
  "No licensed disbursement partner configured. Real fund movement is disabled; " +
  "this posting is simulated and flagged in the ledger.";

// ── M-Pesa Daraja helpers ─────────────────────────────────────────────────

/** Base URL for the M-Pesa Daraja API, depending on environment. */
function mpesaBaseUrl(): string {
  return process.env.MPESA_ENVIRONMENT === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

/**
 * Obtain an OAuth access token from the Daraja sandbox/production endpoint.
 *
 * Uses the consumer key + secret via HTTP Basic auth (the Daraja convention)
 * and requests the `oauth/v1/generate?grant_type=client_credentials` token.
 * In production this is cached for its TTL; the skeleton below calls the
 * endpoint on each use so the integration is verifiable end-to-end before
 * caching is added.
 */
async function mpesaAccessToken(): Promise<string> {
  const base = mpesaBaseUrl();
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error(
      "MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET must be set in .env to use the M-Pesa provider.",
    );
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`M-Pesa token request failed (${response.status}): ${text}`);
  }

  const body = (await response.json()) as { access_token?: string; error_description?: string };
  if (!body.access_token) {
    throw new Error(`M-Pesa token response missing access_token: ${body.error_description ?? JSON.stringify(body)}`);
  }

  return body.access_token;
}

/**
 * Execute an STK push (Send STK Push to customer) against the Daraja API.
 *
 * Flow: C2B -> STK Push. The phone number receives a prompt on their M-Pesa
 * app to enter their PIN and authorise the debit. The result is returned via
 * the callback at MPESA_CALLBACK_URL.
 *
 * `amount` is in KES as an integer (M-Pesa expects the amount in KES as an
 * integer string). `phoneNumber` must be the full 10-digit Kenyan mobile
 * number — sandbox prefers 07..., production uses 2547...
 */
async function mpesaStkPush(params: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  accessToken: string;
}): Promise<{ MerchantRequestID?: string; ResponseCode?: string; errorMessage?: string }> {
  const base = mpesaBaseUrl();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  if (!shortcode || !passkey || !callbackUrl) {
    throw new Error(
      "MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL must be set in .env to use STK Push.",
    );
  }

  // Daraja STK Push request body.
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", "");
  const requestBody = {
    BusinessShortCode: shortcode,
    Password: Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64"),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: String(params.amount),
    PartyA: params.phoneNumber,
    PartyB: shortcode,
    PhoneNumber: params.phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference,
    TransactionDesc: params.transactionDesc,
  };

  const response = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`M-Pesa STK Push failed (${response.status}): ${text}`);
  }

  return (await response.json()) as {
    MerchantRequestID?: string;
    ResponseCode?: string;
    errorMessage?: string;
  };
}

/**
 * Execute a B2C (Business-to-Customer) payment against the Daraja API.
 *
 * Flow: B2C — the platform pays money to a customer's M-Pesa wallet. Used for
 * refunds, payouts, and partner settlements.
 */
async function mpesaB2c(params: {
  phoneNumber: string;
  amount: number;
  occasion?: string;
  accessToken: string;
}): Promise<{ RequestID?: string; ResponseCode?: string; errorMessage?: string }> {
  const base = mpesaBaseUrl();
  const initiator = process.env.MPESA_B2C_INITIATOR?.trim() ?? "BusinessPay";
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL;
  const command = process.env.MPESA_B2C_COMMAND ?? "BusinessPayment";
  const partyB = process.env.MPESA_B2C_ACCOUNT ?? process.env.MPESA_SHORTCODE;

  if (!securityCredential || !partyB) {
    throw new Error(
      "MPESA_B2C_SECURITY_CREDENTIAL and MPESA_B2C_ACCOUNT (or MPESA_SHORTCODE) must be set in .env to use B2C.",
    );
  }

  // Daraja B2C request body.
  const requestBody = {
    InitiatorName: initiator,
    SecurityCredential: securityCredential,
    CommandID: command,
    Amount: String(params.amount),
    PartyA: partyB,
    PartyB: params.phoneNumber,
    AccountReference: "KORA_DISBURSEMENT",
    Remarks: params.occasion ?? "Loan disbursement via Kora Platform",
    QueueTimeoutURL: `${process.env.MPESA_CALLBACK_URL}/timeout`,
    ResultURL: process.env.MPESA_CALLBACK_URL,
  };

  const response = await fetch(`${base}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`M-Pesa B2C failed (${response.status}): ${text}`);
  }

  return (await response.json()) as {
    RequestID?: string;
    ResponseCode?: string;
    errorMessage?: string;
  };
}

// ── Providers ──────────────────────────────────────────────────────────────

/**
 * Default provider for Milestone 1.
 *
 * It records the disbursement in the ledger as a balanced, balanced-entry
 * posting flagged `simulated: true`, then parks the loan at
 * BLOCKED_NO_PARTNER. No funds move and no M-Pesa call is made, so no
 * customer or loan money is ever commingled in a business account.
 */
export class SimulatedProvider implements DisbursementProvider {
  readonly name = "simulated";
  readonly canDisburse = false;

  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    try {
      await prisma.$transaction(async (tx) => {
        await post(
          {
            reference: `DISB-${req.reference}`,
            type: "LOAN_DISBURSEMENT_SIMULATED",
            description: `Simulated loan disbursement for ${req.reference}`,
            accountCode: "LOAN_PRINCIPAL",
            amount: req.amount,
            smeId: req.smeId,
            loanId: req.loanId,
            simulated: true,
            metadata: { provider: this.name, destinationPhone: req.destinationPhone ?? null },
          },
          loanDisbursementLegs(req.amount),
          tx as never,
        );
        await tx.loan.update({
          where: { id: req.loanId },
          data: {
            status: "BLOCKED_NO_PARTNER",
            blockedReason: BLOCKED_REASON,
            simulated: true,
            disbursementRef: `SIM-${req.reference}`,
          },
        });
      });

      return {
        ok: true,
        simulated: true,
        status: "BLOCKED_NO_PARTNER",
        reference: `DISB-${req.reference}`,
        reason: BLOCKED_REASON,
      };
    } catch (err) {
      return {
        ok: false,
        status: "FAILED",
        reason: err instanceof Error ? err.message : "Unknown disbursement error",
      };
    }
  }
}

/**
 * M-Pesa Daraja disbursement provider.
 *
 * Uses the STK Push (CustomerPayBillOnline) flow to send funds to a Kenyan
 * mobile money wallet. Falls back to B2C for payouts that are initiated by
 * the platform rather than triggered by the customer (e.g. refunds).
 *
 * Fail-closed by default: if Daraja credentials are missing the provider
 * sets `canDisburse = false` and returns BLOCKED_NO_PARTNER. When credentials
 * are present and the request succeeds the loan is marked DISBURSED.
 */
export class MpesaProvider implements DisbursementProvider {
  readonly name = "mpesa";
  readonly canDisburse: boolean;

  constructor() {
    // Only advertise real disbursement capability when Daraja credentials are wired.
    this.canDisburse =
      !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_URL);
  }

  async disburse(req: DisbursementRequest): Promise<DisbursementResult> {
    if (!this.canDisburse) {
      return {
        ok: false,
        status: "BLOCKED_NO_PARTNER",
        reason:
          "M-Pesa provider is not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL in .env before enabling it.",
      };
    }

    const phoneNumber = req.destinationPhone?.replace(/^\+?254/, "0") ?? null;
    if (!phoneNumber || !/^07[0-9]{8}$/.test(phoneNumber)) {
      return {
        ok: false,
        status: "FAILED",
        reason: "A valid Kenyan mobile number (starting 07) is required for M-Pesa disbursement.",
      };
    }

    try {
      const accessToken = await mpesaAccessToken();

      // ── STK Push (primary flow) ──
      const stk = await mpesaStkPush({
        phoneNumber,
        amount: req.amount,
        accountReference: req.reference,
        transactionDesc: `Loan disbursement ${req.reference}`,
        accessToken,
      });

      if (stk.ResponseCode !== "0") {
        // Non-zero response code: fall back to B2C.
        const b2c = await mpesaB2c({
          phoneNumber,
          amount: req.amount,
          accessToken,
        }).catch(() => null);

        if (b2c?.ResponseCode !== "0") {
          return {
            ok: false,
            status: "FAILED",
            reason: `M-Pesa STK Push failed (${stk.ResponseCode ?? "unknown"})${stk.errorMessage ? `: ${stk.errorMessage}` : ""}`,
          };
        }

        // B2C succeeded.
        await prisma.$transaction(async (tx) => {
          await post(
            {
              reference: `DISB-${req.reference}`,
              type: "LOAN_DISBURSEMENT_MPESA_B2C",
              description: `M-Pesa B2C disbursement for ${req.reference}`,
              accountCode: "LOAN_PRINCIPAL",
              amount: req.amount,
              smeId: req.smeId,
              loanId: req.loanId,
              simulated: false,
              metadata: { provider: this.name, destinationPhone: phoneNumber, b2cRequestId: b2c.RequestID ?? null },
            },
            loanDisbursementLegs(req.amount),
            tx as never,
          );
          await tx.loan.update({
            where: { id: req.loanId },
            data: {
              status: "DISBURSED",
              disbursementRef: b2c.RequestID ?? `MPESA-B2C-${req.reference}`,
            },
          });
        });

        return {
          ok: true,
          simulated: false,
          status: "DISBURSED",
          reference: b2c.RequestID ?? `DISB-${req.reference}`,
        };
      }

      // ── STK Push succeeded ──
      await prisma.$transaction(async (tx) => {
        await post(
          {
            reference: `DISB-${req.reference}`,
            type: "LOAN_DISBURSEMENT_MPESA_STK",
            description: `M-Pesa STK Push disbursement for ${req.reference}`,
            accountCode: "LOAN_PRINCIPAL",
            amount: req.amount,
            smeId: req.smeId,
            loanId: req.loanId,
            simulated: false,
            metadata: { provider: this.name, destinationPhone: phoneNumber, stkMerchantRequestId: stk.MerchantRequestID ?? null },
          },
          loanDisbursementLegs(req.amount),
          tx as never,
        );
        await tx.loan.update({
          where: { id: req.loanId },
          data: {
            status: "DISBURSED",
            disbursementRef: stk.MerchantRequestID ?? `MPESA-STK-${req.reference}`,
          },
        });
      });

      return {
        ok: true,
        simulated: false,
        status: "DISBURSED",
        reference: stk.MerchantRequestID ?? `DISB-${req.reference}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: "FAILED",
        reason: err instanceof Error ? err.message : "Unknown M-Pesa disbursement error",
      };
    }
  }
}

/**
 * Placeholder for a licensed lender integration.
 *
 * Deliberately not implemented: until a CBK-licensed partner is in place and
 * the partner API contract exists, this must fail closed rather than fall
 * back to moving funds from a pooled account.
 */
export class PartnerProvider implements DisbursementProvider {
  readonly name = "partner";
  readonly canDisburse = false;

  async disburse(_req: DisbursementRequest): Promise<DisbursementResult> {
    return {
      ok: false,
      status: "BLOCKED_NO_PARTNER",
      reason:
        "PartnerProvider is not configured. Set up a CBK-licensed disbursement partner before enabling it.",
    };
  }
}
