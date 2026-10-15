import { prisma } from "@kora/database";

type C2BPayload = {
  TransID?: unknown;
  TransAmount?: unknown;
  BusinessShortCode?: unknown;
  BillRefNumber?: unknown;
};

export function parseC2bPayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as C2BPayload;
  const transactionId = typeof payload.TransID === "string" ? payload.TransID.trim() : "";
  const shortcode = String(payload.BusinessShortCode ?? "").trim();
  const amount = Number(payload.TransAmount);
  const billReference = typeof payload.BillRefNumber === "string"
    ? payload.BillRefNumber.trim()
    : "";
  if (
    !/^[A-Za-z0-9]{4,32}$/.test(transactionId) ||
    !/^\d{4,12}$/.test(shortcode) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    billReference.length > 128
  ) {
    return null;
  }
  return { transactionId, shortcode, amount, billReference };
}

export async function findC2bSme(shortcode: string): Promise<string | null> {
  const matches = await prisma.sME.findMany({
    where: {
      onboardingStatus: "APPROVED",
      OR: [{ mpesaTill: shortcode }, { mpesaPaybill: shortcode }],
    },
    select: { id: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].id : null;
}
