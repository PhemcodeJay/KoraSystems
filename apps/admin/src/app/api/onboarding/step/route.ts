import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/** The steps the wizard records, in order. */
const STEPS = ["BUSINESS_INFO", "PRODUCTS", "PAYMENTS", "COMPLETE"] as const;

/** Where each completed step hands over to next. */
const NEXT_STEP: Record<string, (typeof STEPS)[number]> = {
  BUSINESS_INFO: "PRODUCTS",
  PRODUCTS: "PAYMENTS",
  PAYMENTS: "COMPLETE",
  COMPLETE: "COMPLETE",
};

/**
 * Record one onboarding step.
 *
 * The SME wizard posted to this path from a separate origin before the apps
 * were merged, and no handler existed — every step silently 404ed, so
 * onboarding could never advance past its first screen. `smeId` comes from the
 * session, never the body, so a business can only onboard itself.
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

  const body = (await request.json().catch(() => null)) as {
    step?: unknown;
    data?: Record<string, unknown>;
  } | null;

  const step = String(body?.step ?? "");
  if (!(STEPS as readonly string[]).includes(step)) {
    return NextResponse.json({ error: "Unknown onboarding step." }, { status: 400 });
  }

  const current = await prisma.sME.findUnique({
    where: { id: scope.smeId },
    select: { onboardingStep: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }
  if (current.onboardingStep !== step || step === "COMPLETE") {
    return NextResponse.json(
      { error: "Complete the current onboarding step before moving on." },
      { status: 409 },
    );
  }
  if (step === "PRODUCTS") {
    const productCount = await prisma.product.count({
      where: { smeId: scope.smeId, isActive: true },
    });
    if (productCount === 0) {
      return NextResponse.json(
        { error: "Add at least one product before continuing." },
        { status: 400 },
      );
    }
  }

  const data = body?.data ?? {};
  const update: {
    businessName?: string;
    businessType?: string | null;
    registrationNumber?: string | null;
    county?: string | null;
    town?: string | null;
    yearsInBusiness?: number;
    onboardingStep: (typeof STEPS)[number];
    onboardingStatus: "IN_PROGRESS";
  } = { onboardingStep: NEXT_STEP[step], onboardingStatus: "IN_PROGRESS" };

  if (typeof data.businessName === "string" && data.businessName.trim()) {
    update.businessName = data.businessName.trim();
  }
  if (typeof data.businessType === "string") {
    update.businessType = data.businessType.trim() || null;
  }
  if (typeof data.registrationNumber === "string") {
    update.registrationNumber = data.registrationNumber.trim() || null;
  }
  if (typeof data.county === "string") update.county = data.county.trim() || null;
  if (typeof data.town === "string") update.town = data.town.trim() || null;
  if (data.yearsInBusiness !== undefined && data.yearsInBusiness !== null) {
    const years = Number(data.yearsInBusiness);
    if (Number.isFinite(years) && years >= 0) update.yearsInBusiness = Math.floor(years);
  }

  // Advancing without a name would leave an unidentifiable business downstream.
  if (step === "BUSINESS_INFO" && !update.businessName) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 },
    );
  }

  const sme = await prisma.sME.update({
    where: { id: scope.smeId },
    data: update,
    select: { id: true, onboardingStep: true, onboardingStatus: true },
  });

  return NextResponse.json({ data: sme });
}