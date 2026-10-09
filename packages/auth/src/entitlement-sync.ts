import type { Prisma } from "@kora/database";
import {
  rolesForTier,
  statusGrantsAccess,
  type GrantableRole,
  type SubStatus,
  type Tier,
} from "./entitlements";

/**
 * Keeps a user's granted roles and plan row consistent with their tier.
 *
 * ── The invariant ─────────────────────────────────────────────────────────
 * A user's secondary roles are *derived* from their tier, never set
 * independently. If they were independent, a downgrade would leave a Metal
 * user still holding the Customer role with no way to notice, and the billing
 * screen and the access check would disagree. Deriving them here means the
 * only thing that can change what a user reaches is their tier.
 *
 * ── Downgrades preserve data ──────────────────────────────────────────────
 * Revoking a role sets `revokedAt`; it never deletes the SME / Supplier /
 * Customer row or its history. A user who upgrades, trades, then downgrades
 * must find their data intact when they upgrade again — destroying a year of
 * sales history because a payment lapsed would be indefensible. `@@unique` on
 * `[userId, role]` lets a re-grant be an un-revoke, which keeps the original
 * `grantedAt` as an honest record of when access was first sold.
 */

/** Roles a subscription is allowed to grant. ADMIN is excluded: staff are
 *  never granted roles by billing and must never lose console access. */
const GRANTABLE: readonly GrantableRole[] = ["SUPPLIER", "CUSTOMER"];

/**
 * The database handle these helpers need.
 *
 * Typed structurally off `Prisma.TransactionClient` rather than
 * `PrismaClient`, so the same functions work inside a caller's `$transaction`
 * as well as against the shared singleton — a subscription change and its audit
 * row have to commit together or not at all.
 */
type Db = Prisma.TransactionClient;

export type SyncResult = {
  granted: GrantableRole[];
  revoked: GrantableRole[];
};

/**
 * Reconcile `user_role_assignments` against what the tier entitles.
 *
 * Returns what changed so callers can surface it in an audit trail or a
 * "your plan now includes…" toast.
 */
export async function syncRoleAssignments(
  db: Db,
  userId: string,
  tier: Tier | null | undefined,
  options: { status?: SubStatus | null; reason?: string } = {},
): Promise<SyncResult> {
  const entitled = statusGrantsAccess(options.status) ? rolesForTier(tier) : [];

  const granted: GrantableRole[] = [];
  const revoked: GrantableRole[] = [];

  for (const role of GRANTABLE) {
    const shouldHave = (entitled as readonly string[]).includes(role);
    const existing = await db.userRoleAssignment.findUnique({
      where: { userId_role: { userId, role } },
      select: { id: true, revokedAt: true },
    });

    if (shouldHave && !existing) {
      await db.userRoleAssignment.create({
        data: { userId, role, grantedVia: tier ?? null, reason: options.reason },
      });
      granted.push(role);
    } else if (shouldHave && existing?.revokedAt) {
      // Re-grant by clearing revokedAt rather than reinserting, so the unique
      // constraint cannot fire and grantedAt keeps its original meaning.
      await db.userRoleAssignment.update({
        where: { id: existing.id },
        data: { revokedAt: null, revokedBy: null, grantedVia: tier ?? null },
      });
      granted.push(role);
    } else if (!shouldHave && existing && !existing.revokedAt) {
      await db.userRoleAssignment.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
      revoked.push(role);
    }
  }

  return { granted, revoked };
}

/**
 * Create or update a user's plan, then reconcile their roles to match.
 *
 * Every subscription change funnels through here so the audit row and the
 * entitlement sync cannot be applied one without the other — a tier change
 * with no `SubscriptionEvent` leaves no way to answer "who did this".
 */
export async function setUserPlan(
  db: Db,
  input: {
    userId: string;
    tier: Tier;
    status?: SubStatus;
    cycle?: string;
    amount?: number;
    currentPeriodEnd?: Date | null;
    adminId?: string | null;
    reason?: string;
  },
): Promise<{ tier: Tier; granted: GrantableRole[]; revoked: GrantableRole[] }> {
  const status = input.status ?? "ACTIVE";

  const before = await db.userPlan.findUnique({
    where: { userId: input.userId },
    select: { tier: true, status: true },
  });

  await db.userPlan.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      tier: input.tier,
      status,
      cycle: input.cycle ?? "MONTHLY",
      amount: input.amount ?? 0,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    },
    update: {
      tier: input.tier,
      status,
      ...(input.cycle ? { cycle: input.cycle } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: input.currentPeriodEnd }
        : {}),
      cancelledAt: status === "CANCELLED" ? new Date() : null,
    },
  });

  // Append-only. Written even when the values did not change, because "an
  // admin opened this page and saved" is itself worth recording.
  await db.subscriptionEvent.create({
    data: {
      userId: input.userId,
      adminId: input.adminId ?? null,
      fromTier: before?.tier ?? null,
      toTier: input.tier,
      fromStatus: before?.status ?? null,
      toStatus: status,
      amount: input.amount ?? 0,
      cycle: input.cycle ?? null,
      reason: input.reason ?? null,
    },
  });

  const { granted, revoked } = await syncRoleAssignments(db, input.userId, input.tier, {
    status,
    reason: input.reason,
  });

  return { tier: input.tier, granted, revoked };
}

/**
 * Give a new account its starting plan and matching roles.
 *
 * Every account starts on FREE regardless of what they registered as: an SME
 * who signs up gets SalesPilot and has to be moved up by an admin. Auto-granting
 * a paid tier on sign-up would let anyone self-serve into the Neobank
 * surfaces, which are the ones that touch money.
 */
export async function provisionNewUser(
  db: Db,
  userId: string,
  options: { tier?: Tier; reason?: string } = {},
): Promise<SyncResult> {
  const tier = options.tier ?? "FREE";
  await db.userPlan.upsert({
    where: { userId },
    create: { userId, tier, status: "ACTIVE", amount: 0 },
    update: {},
  });
  return syncRoleAssignments(db, userId, tier, {
    status: "ACTIVE",
    reason: options.reason ?? "Account created",
  });
}
