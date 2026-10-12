/**
 * Provision billing for a brand-new SME tenant: owner seat + trial/plan row.
 */
import type { Prisma } from "@kora/database";
import {
  TIERS,
  priceForCycle,
  type BillingCycle,
  type SubStatus,
  type Tier,
} from "./entitlements";
import { syncRoleAssignments } from "./entitlement-sync";
import { getTenantSubscription, type TenantSubscriptionState } from "./tenant-billing";

type Db = Prisma.TransactionClient;
const ACTIVE_TENANT_STATUSES = ["ACTIVE", "PAST_DUE", "TRIALING"] as const;

// Optional-table access until `prisma generate` runs post-migration.
type TenantDb = Db & {
  smeMember?: { upsert(args: unknown): Promise<unknown> };
  smeSubscription?: {
    updateMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<{ id: string; tier: string; status: string; cycle: string; trialEndsAt: Date | null; currentPeriodEnd: Date | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
  smeBillingEvent?: { create(args: unknown): Promise<unknown> };
};

export async function provisionTenantSubscription(
  db: Db,
  smeId: string,
  ownerUserId: string,
  ownerEmail: string,
  tier: Tier = "FREE",
  cycle: BillingCycle = "MONTHLY",
): Promise<TenantSubscriptionState> {
  const def = TIERS[tier];
  const trialDays = def.limits.trialDays;
  const now = new Date();
  const trialEndsAt =
    trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
  const status: SubStatus = trialDays > 0 ? "TRIALING" : "ACTIVE";
  const amount = tier === "FREE" ? 0 : priceForCycle(tier, cycle);
  const periodEnd =
    tier === "FREE"
      ? null
      : new Date(now.getTime() + (cycle === "YEARLY" ? 365 : 30) * 24 * 60 * 60 * 1000);
  const tdb = db as TenantDb;
  // Pre-migration the tenant tables do not exist — provisioning is a no-op
  // and the UserPlan fallback remains the source of truth.
  if (!tdb.smeMember || !tdb.smeSubscription || !tdb.smeBillingEvent) {
    return getTenantSubscription(db, smeId);
  }
  await tdb.smeMember.upsert({
    where: { smeId_email: { smeId, email: ownerEmail.toLowerCase() } },
    create: {
      smeId,
      userId: ownerUserId,
      email: ownerEmail.toLowerCase(),
      role: "OWNER",
      invitedBy: ownerUserId,
    },
    update: { userId: ownerUserId, role: "OWNER", isActive: true },
  });
  await tdb.smeSubscription.updateMany({
    where: { smeId, status: { in: [...ACTIVE_TENANT_STATUSES] } },
    data: { status: "EXPIRED" },
  });
  await tdb.smeSubscription.create({
    data: { smeId, tier, status, cycle, amount, trialEndsAt, currentPeriodEnd: periodEnd },
  });
  await tdb.smeBillingEvent.create({
    data: {
      smeId,
      actorUserId: ownerUserId,
      toTier: tier,
      toStatus: status,
      amount,
      cycle,
      reason: trialEndsAt ? `Trial started (${trialDays}d)` : "Tenant provisioned",
    },
  });
  await db.sME.update({
    where: { id: smeId },
    data: {
      subscriptionStatus: status as never,
      subscriptionAmount: amount,
      subscriptionCycle: cycle,
    },
  });
  return getTenantSubscription(db, smeId);
}

/** Change a tenant's plan, preserving history and re-syncing owner roles. */
export async function setTenantPlan(
  db: Db,
  input: {
    smeId: string;
    tier: Tier;
    status?: SubStatus;
    cycle?: BillingCycle;
    currentPeriodEnd?: Date | null;
    /**
     * When a TRIALING row should auto-expire. Omitted falls back to the live
     * row's value; pass it explicitly when *starting* a trial, because a fresh
     * tenant has no prior row to inherit a date from — without it the trial
     * would be written with `trialEndsAt: null` and never lapse.
     */
    trialEndsAt?: Date | null;
    actorUserId?: string | null;
    reason?: string;
    mpesaReceipt?: string | null;
    transactionReference?: string | null;
  },
): Promise<TenantSubscriptionState> {
  const tdb = db as TenantDb;
  if (!tdb.smeSubscription || !tdb.smeBillingEvent) {
    throw new Error("Tenant billing tables are not migrated yet.");
  }
  const live = await tdb.smeSubscription.findFirst({
    where: { smeId: input.smeId, status: { in: [...ACTIVE_TENANT_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });
  const status = input.status ?? "ACTIVE";
  const cycle = input.cycle ?? ((live?.cycle as BillingCycle) || "MONTHLY");
  const amount = input.tier === "FREE" ? 0 : priceForCycle(input.tier, cycle);
  if (live) {
    await tdb.smeSubscription.update({ where: { id: live.id }, data: { status: "EXPIRED" } });
  }
  await tdb.smeSubscription.create({
    data: {
      smeId: input.smeId,
      tier: input.tier,
      status,
      cycle,
      amount,
      currentPeriodEnd: input.currentPeriodEnd ?? live?.currentPeriodEnd ?? null,
      trialEndsAt:
        status === "TRIALING"
          ? input.trialEndsAt ?? live?.trialEndsAt ?? null
          : null,
    },
  });
  await tdb.smeBillingEvent.create({
    data: {
      smeId: input.smeId,
      actorUserId: input.actorUserId ?? null,
      fromTier: (live?.tier as Tier | undefined) ?? null,
      toTier: input.tier,
      fromStatus: (live?.status as SubStatus | undefined) ?? null,
      toStatus: status,
      amount,
      cycle,
      reason: input.reason ?? null,
      mpesaReceipt: input.mpesaReceipt ?? null,
      transactionReference: input.transactionReference ?? null,
    },
  });
  await db.sME.update({
    where: { id: input.smeId },
    data: {
      subscriptionStatus: status as never,
      subscriptionAmount: amount,
      subscriptionCycle: cycle,
      ...(status === "ACTIVE" ? { subscriptionPaidAt: new Date() } : {}),
    },
  });
  const sme = await db.sME.findUnique({
    where: { id: input.smeId },
    select: { userId: true },
  });
  if (sme) {
    await syncRoleAssignments(db, sme.userId, input.tier, {
      status,
      reason: input.reason ?? `Tenant plan to ${input.tier}`,
    });
  }
  return getTenantSubscription(db, input.smeId);
}
