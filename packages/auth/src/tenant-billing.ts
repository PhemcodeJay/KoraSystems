/**
 * SaaS tenant billing — the SME is the billable tenant, not the user.
 *
 * Pre-SaaS the plan lived on `user_plans` keyed by the owner's userId. That
 * billed a person: two owners of one shop paid twice, and a staff seat had no
 * tenant to belong to. Now the source of truth is `sme_subscriptions` keyed
 * by smeId, with `sme_members` seats and `sme_billing_events` audit rows.
 *
 * Resolution order (backwards compatible): live tenant row → owner's
 * UserPlan → legacy `smes.subscriptionStatus` mirror → FREE default.
 */
import type { Prisma } from "@kora/database";
import {
  limitsForTier,
  type BillingCycle,
  type SubStatus,
  type Tier,
} from "./entitlements";

type Db = Prisma.TransactionClient;

/**
 * New SaaS tables are optional until the migration lands. Prisma's generated
 * types only know them after `prisma generate`, so access them through a
 * structural cast: present at runtime post-migration, `undefined` before —
 * and every helper below degrades to the UserPlan fallback when undefined.
 */
type SmeSubscriptionRow = {
  id: string;
  tier: string;
  status: string;
  cycle: string;
  amount: unknown;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

type SmeSubscriptionDelegate = {
  findFirst(args: unknown): Promise<SmeSubscriptionRow | null>;
};

type SmeMemberDelegate = {
  count(args: unknown): Promise<number>;
};

type TenantDb = Db & {
  smeSubscription?: SmeSubscriptionDelegate;
  smeMember?: SmeMemberDelegate;
};

function tenantDb(db: Db): TenantDb {
  return db as TenantDb;
}

export type TenantSubscriptionState = {
  smeId: string;
  tier: Tier;
  status: SubStatus;
  cycle: BillingCycle;
  amount: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  seatsUsed: number;
  seatsLimit: number;
  source: "sme_subscription" | "user_plan" | "legacy_sme" | "default_free";
};

const ACTIVE_TENANT_STATUSES = ["ACTIVE", "PAST_DUE", "TRIALING"] as const;

/** Resolve the billable state for one SME tenant. */
export async function getTenantSubscription(
  db: Db,
  smeId: string,
): Promise<TenantSubscriptionState> {
  const tdb = tenantDb(db);
  const [live, sme] = await Promise.all([
    tdb.smeSubscription
      ? tdb.smeSubscription.findFirst({
          where: { smeId, status: { in: [...ACTIVE_TENANT_STATUSES] } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
    db.sME.findUnique({
      where: { id: smeId },
      select: {
        userId: true,
        subscriptionStatus: true,
        subscriptionAmount: true,
      },
    }),
  ]);
  const seatsUsed = tdb.smeMember
    ? await tdb.smeMember.count({ where: { smeId, isActive: true } }).catch(() => 0)
    : 0;
  if (live) {
    const tier = live.tier as Tier;
    let status = live.status as SubStatus;
    if (status === "TRIALING" && live.trialEndsAt && live.trialEndsAt < new Date()) {
      status = "EXPIRED";
    }
    return {
      smeId,
      tier,
      status,
      cycle: (live.cycle as BillingCycle) ?? "MONTHLY",
      amount: Number(live.amount ?? 0),
      trialEndsAt: live.trialEndsAt,
      currentPeriodEnd: live.currentPeriodEnd,
      seatsUsed,
      seatsLimit: limitsForTier(tier)?.seats ?? 3,
      source: "sme_subscription",
    };
  }
  if (sme) {
    const ownerPlan = await db.userPlan.findUnique({
      where: { userId: sme.userId },
      select: { tier: true, status: true, amount: true, cycle: true },
    });
    if (ownerPlan) {
      const tier = ownerPlan.tier as Tier;
      return {
        smeId,
        tier,
        status: ownerPlan.status as SubStatus,
        cycle: ownerPlan.cycle === "YEARLY" ? "YEARLY" : "MONTHLY",
        amount: Number(ownerPlan.amount ?? 0),
        trialEndsAt: null,
        currentPeriodEnd: null,
        seatsUsed,
        seatsLimit: limitsForTier(tier)?.seats ?? 3,
        source: "user_plan",
      };
    }
    return {
      smeId,
      tier: "FREE",
      status: sme.subscriptionStatus as SubStatus,
      cycle: "MONTHLY",
      amount: Number(sme.subscriptionAmount ?? 0),
      trialEndsAt: null,
      currentPeriodEnd: null,
      seatsUsed,
      seatsLimit: limitsForTier("FREE")?.seats ?? 3,
      source: "legacy_sme",
    };
  }
  return {
    smeId,
    tier: "FREE",
    status: "ACTIVE",
    cycle: "MONTHLY",
    amount: 0,
    trialEndsAt: null,
    currentPeriodEnd: null,
    seatsUsed,
    seatsLimit: 3,
    source: "default_free",
  };
}
