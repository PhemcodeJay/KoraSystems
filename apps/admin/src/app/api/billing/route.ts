import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";

/**
 * Tenant billing state for the caller's SME.
 *
 * One endpoint for the billing page: current tier/status/period, trial
 * countdown, seat usage vs cap, resource usage vs caps, and recent billing
 * events. Pre-migration (no `sme_subscriptions` table) it degrades to the
 * owner's UserPlan instead of 500ing.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  try {
    const { requireScope } = await import("@kora/auth/guards");
    const scope = await requireScope("SME", "ADMIN");
    const smeId = scope.smeId ?? auth.user.tenantSmeId ?? null;
    if (!smeId) {
      return NextResponse.json({ error: "No business is linked to this account." }, { status: 403 });
    }
    const { getTenantSubscription } = await import("@kora/auth/tenant-billing");
    const { getTenantUsage } = await import("@kora/auth/tenant-usage");
    const { TIERS } = await import("@kora/auth/entitlements");
    const sub = await getTenantSubscription(prisma, smeId);
    const usage = await getTenantUsage(prisma, smeId, sub.tier);
    const events = await prisma.smeBillingEvent.findMany({
      where: { smeId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({
      data: {
        subscription: sub,
        usage,
        catalogue: Object.values(TIERS).map((t) => ({
          tier: t.tier,
          name: t.name,
          price: t.price,
          yearlyPrice: t.yearlyPrice,
          apps: t.apps,
          roles: t.roles,
          features: [...t.features],
          popular: !!t.popular,
          limits: { ...t.limits },
        })),
        events: events.map((e) => ({
          id: e.id,
          fromTier: e.fromTier,
          toTier: e.toTier,
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          amount: Number(e.amount),
          reason: e.reason,
          mpesaReceipt: e.mpesaReceipt,
          createdAt: e.createdAt,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Billing is unavailable right now." }, { status: 503 });
  }
}
