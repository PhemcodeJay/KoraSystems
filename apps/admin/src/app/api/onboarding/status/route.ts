import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * The caller's own onboarding state, so the wizard can resume where it left
 * off after a refresh instead of starting over at business information.
 */
export async function GET() {
  const auth = await withAuth("SME");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME");
  if (!scope.smeId) {
    return NextResponse.json(
      { error: "No business is linked to this account." },
      { status: 403 },
    );
  }

  const sme = await prisma.sME.findUnique({
    where: { id: scope.smeId },
    select: {
      businessName: true,
      onboardingStep: true,
      onboardingStatus: true,
      mpesaTill: true,
      mpesaPaybill: true,
    },
  });
  if (!sme) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: sme,
    mpesaPaybill: process.env.MPESA_PAYBILL || "",
    mpesaTillNumber: process.env.MPESA_TILL_NUMBER || "",
    mpesaBusinessName: process.env.MPESA_BUSINESS_NAME || "",
  });
}