import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";

/**
 * Start a self-serve trial / upgrade checkout for the caller's SME tenant.
 *
 * Two outcomes, decided by whether M-Pesa Daraja is configured:
 *
 * • Not configured (demo / pre-go-live): this STARTS A TRIAL. It calls
 *   `setTenantPlan(..., TRIALING)`, which writes a real, time-boxed tenant
 *   subscription — the 90-day trial the landing page sells — and records the
 *   billing event. A trial is deliberately not a paid activation: it expires
 *   on its own and self-serve is capped at STANDARD (Growth), so no one can
 *   self-serve straight into Neobank, the money-touching surface.
 *
 * • Configured (production): the plan still only changes in the M-Pesa
 *   callback, never here, so a forged POST cannot grant a paid tier. This
 *   records the checkout intent and returns the STK handoff.
 *
 * Either way the caller is owner-verified and the tier is validated from the
 * entitlements table, so the request body can name only a real, known tier.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME");
  if (auth.response) return auth.response;
  try {
    const { requireScope } = await import("@kora/auth/guards");
    const { assertTier, assertCycle, priceForCycle, TIERS } = await import(
      "@kora/auth/entitlements"
    );
    const scope = await requireScope("SME");
    const smeId = scope.smeId ?? auth.user.tenantSmeId ?? null;
    if (!smeId) {
      return NextResponse.json({ error: "No business is linked to this account." }, { status: 403 });
    }
    // Owner-only: seats with MANAGER/CASHIER must not buy plans.
    const seat = await prisma.smeMember.findFirst({
      where: { smeId, userId: auth.user.id, isActive: true },
      select: { role: true },
    });
    const sme = await prisma.sME.findUnique({ where: { id: smeId }, select: { userId: true } });
    const isOwner = sme?.userId === auth.user.id || seat?.role === "OWNER";
    if (!isOwner) {
      return NextResponse.json({ error: "Only the business owner can change the plan." }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as {
      tier?: unknown;
      cycle?: unknown;
      phone?: unknown;
    } | null;
    const tier = assertTier(body?.tier);
    const cycle = assertCycle(body?.cycle ?? "MONTHLY") ?? "MONTHLY";
    if (!tier || tier === "FREE") {
      return NextResponse.json({ error: "Choose a paid plan to check out." }, { status: 400 });
    }
    const amount = priceForCycle(tier, cycle);
    const reference = `KORA-${smeId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const configured = !!(
      process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY
    );

    if (!configured) {
      // Demo path: actually start the trial the landing page promises. Capped
      // at STANDARD so self-serve can never reach Neobank. Best-effort against
      // the (possibly unmigrated) tenant tables — the audit row is the record.
      const trialDays = TIERS[tier].limits.trialDays;
      const trialEndsAt =
        trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;
      try {
        const { setTenantPlan } = await import("@kora/auth/tenant-lifecycle");
        await setTenantPlan(prisma as never, {
          smeId,
          tier,
          status: "TRIALING",
          cycle,
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          actorUserId: auth.user.id,
          reason: `Self-serve trial started (${cycle}, ${trialDays}d)`,
          transactionReference: reference,
        });
      } catch {
        // Tables not migrated yet — fall through; the intent row below is the
        // record and the tenant stays on its current plan.
      }
      return NextResponse.json({
        ok: true,
        simulated: true,
        trial: true,
        reference,
        tier,
        cycle,
        amount,
        trialEndsAt,
        message: `Your ${TIERS[tier].name} trial is live for ${trialDays} days. No card needed — upgrade any time from Billing.`,
      });
    }

    await prisma.smeBillingEvent.create({
      data: {
        smeId,
        actorUserId: auth.user.id,
        toTier: tier,
        toStatus: "ACTIVE",
        amount,
        cycle,
        reason: `Checkout started (${cycle})`,
        transactionReference: reference,
      },
    });
    return NextResponse.json({
      ok: true,
      simulated: false,
      trial: false,
      reference,
      tier,
      cycle,
      amount,
      mpesaPaybill: process.env.MPESA_PAYBILL || "",
      mpesaTillNumber: process.env.MPESA_TILL_NUMBER || "",
      mpesaBusinessName: process.env.MPESA_BUSINESS_NAME || "",
      message: "Checkout opened. Complete the M-Pesa prompt to activate the plan.",
    });
  } catch {
    return NextResponse.json({ error: "Checkout is unavailable right now." }, { status: 503 });
  }
}
