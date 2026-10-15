import { prisma } from "@kora/database";
import { NextResponse } from "next/server";
import { findC2bSme } from "@/lib/mpesa-c2b";
import { parseC2bPayload } from "@/lib/mpesa-c2b-payload";

type C2BPayload = {
  TransTime?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as C2BPayload | null;
  const payload = parseC2bPayload(body);
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

  const transactionTime =
    typeof body?.TransTime === "string" && /^\d{14}$/.test(body.TransTime)
      ? body.TransTime
      : null;
  await prisma.transaction.upsert({
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
  });

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
