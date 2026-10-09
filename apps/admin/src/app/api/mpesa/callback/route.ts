import { prisma } from "@kora/database";
import { NextResponse } from "next/server";

/**
 * M-Pesa STK callback — Daraja tells us how the prompt on the phone ended.
 *
 * ── Why this endpoint has no auth ───────────────────────────────────────────
 * Daraja posts here from its own infrastructure with no session and no shared
 * signature, so `withAuth` would reject it. That means the body is attacker
 * controllable, which shapes everything below: the handler is allowed to *mark
 * an existing pending payment* as settled and nothing more. It can never mint
 * money, never creates a Transaction that is not already there, and rejects
 * outright when the amount on the callback disagrees with the amount we asked
 * for. A forged callback for a reference we never opened resolves to no row and
 * is acknowledged as a no-op rather than an error — Daraja retries on non-zero
 * codes, and retrying a payload we will never accept helps nobody.
 *
 * The row is found by `AccountReference`, which `/api/mpesa/stk` sets to the
 * same `reference` it sends to Daraja, so the two sides meet on a value we
 * chose rather than on anything the caller supplied.
 */

type DarajaItem = { Name: string; Value?: string | number };
type DarajaCallback = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: DarajaItem[] };
    };
  };
};

function meta(items: DarajaItem[] | undefined, name: string): string | null {
  const hit = items?.find((i) => i.Name === name);
  return hit?.Value === undefined || hit.Value === null ? null : String(hit.Value);
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as DarajaCallback | null;
  const cb = payload?.Body?.stkCallback;

  // A malformed body still gets a success ack: Daraja treats a non-zero
  // ResultCode as "retry", and replaying an unusable payload forever is worse
  // than dropping it.
  if (!cb) return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored" });

  const reference = meta(cb.CallbackMetadata?.Item, "AccountReference");
  const receipt = meta(cb.CallbackMetadata?.Item, "MpesaReceiptNumber");
  const amountRaw = meta(cb.CallbackMetadata?.Item, "Amount");

  if (!reference) return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored" });

  const txn = await prisma.transaction.findUnique({ where: { reference } });

  // Nothing we opened, or it is already settled — both are no-ops. Returning
  // success stops the retry loop without changing any balance.
  if (!txn) return NextResponse.json({ ResultCode: 0, ResultDesc: "No such payment" });

  const current = (txn.metadata ?? {}) as Record<string, unknown>;
  if (current.status === "SUCCESS") {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Already settled" });
  }

  // The customer declined, entered the wrong PIN, or the prompt timed out.
  if (cb.ResultCode !== 0) {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        metadata: {
          ...current,
          status: "FAILED",
          resultCode: cb.ResultCode ?? -1,
          resultDesc: cb.ResultDesc ?? "Failed",
        },
      },
    });
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Recorded" });
  }

  if (!receipt || !amountRaw) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Ignored" });
  }

  const amount = Number(amountRaw);
  // Amount is the one field an attacker would change to settle a small pending
  // row for more than was asked. A mismatch is refused rather than logged and
  // accepted.
  if (!Number.isFinite(amount) || Math.abs(amount - Number(txn.amount)) > 0.01) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Amount mismatch" });
  }

  await prisma.transaction.update({
    where: { id: txn.id },
    data: {
      metadata: {
        ...current,
        status: "SUCCESS",
        mpesaReceipt: receipt,
        settledAt: new Date().toISOString(),
        checkoutRequestId: cb.CheckoutRequestID ?? current.checkoutRequestId ?? null,
      },
    },
  });

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
