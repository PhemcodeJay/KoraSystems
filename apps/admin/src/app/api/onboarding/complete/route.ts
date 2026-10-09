import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Finish SME onboarding.
 *
 * Sets the M-Pesa till (when one was given) and closes the wizard. Completing
 * without ever submitting business information would strand an unidentifiable
 * business in the platform, so that is refused rather than accepted.
 *
 * Status lands on APPROVED rather than PENDING_REVIEW: no console anywhere in
 * the product can review a pending business, so parking it there would leave
 * every finished setup permanently unfinished.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME");
  if (!scope.smeId) {
    return NextResponse.json(
      { error: "No business is linked to this account." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    mpesaTill?: unknown;
  };
  const till =
    typeof body.mpesaTill === "string" ? body.mpesaTill.trim() : "";

  const existing = await prisma.sME.findUnique({
    where: { id: scope.smeId },
    select: { businessName: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }
  if (!existing.businessName.trim()) {
    return NextResponse.json(
      { error: "Finish the business information step first." },
      { status: 400 },
    );
  }

  const sme = await prisma.sME.update({
    where: { id: scope.smeId },
    data: {
      ...(till ? { mpesaTill: till } : {}),
      onboardingStep: "COMPLETE",
      onboardingStatus: "APPROVED",
    },
    select: { id: true, onboardingStep: true, onboardingStatus: true },
  });

  return NextResponse.json({ data: sme });
}