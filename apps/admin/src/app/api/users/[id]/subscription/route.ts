import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { setUserPlan } from "@kora/auth/entitlement-sync";
import { TIERS, assertStatus, assertTier } from "@kora/auth/entitlements";
import { NextResponse } from "next/server";

/**
 * Change an account's subscription tier and/or billing status.
 *
 * ── One endpoint, not two ────────────────────────────────────────────────
 * Tier and status move together: granting METAL while the plan is CANCELLED,
 * or downgrading a tier without expiring it, both produce states the UI cannot
 * explain to a customer. `setUserPlan` writes the plan, appends the audit row
 * and reconciles granted roles as one unit, so they cannot drift.
 *
 * The tier decides the price, not the caller's number: an admin form that
 * posts `tier: "METAL", amount: 1` must not be able to sell Enterprise for a
 * shilling. The amount comes from the catalogue in `@kora/auth/entitlements`.
 *
 * A downgrade revokes roles but never deletes the SME / Supplier / Customer
 * rows behind them — see `syncRoleAssignments`.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    tier?: string;
    status?: string;
    cycle?: string;
    currentPeriodEnd?: string | null;
    reason?: string;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "No such user." }, { status: 404 });

  const existing = await prisma.userPlan.findUnique({
    where: { userId: params.id },
    select: { tier: true, status: true, cycle: true, currentPeriodEnd: true },
  });

  // Narrow the tier before use. An unknown string must not reach `setUserPlan`,
  // where it would become an invalid enum write.
  const tier = body.tier !== undefined ? assertTier(body.tier) : existing?.tier ?? "FREE";
  if (!tier) {
    return NextResponse.json(
      { error: `Unknown plan tier. Expected one of FREE, STANDARD, METAL.` },
      { status: 400 },
    );
  }

  const status = body.status !== undefined ? assertStatus(body.status) : existing?.status ?? "ACTIVE";
  if (!status) {
    return NextResponse.json(
      { error: `Unknown status. Expected one of ACTIVE, PAST_DUE, CANCELLED, EXPIRED.` },
      { status: 400 },
    );
  }

  // Staff are not subscribers. Tiering an admin would push them through the
  // same entitlement sync as customers and is never what an admin means.
  if (target.role === "ADMIN" && (body.tier || body.status)) {
    return NextResponse.json(
      { error: "Platform admins are not billed and cannot be placed on a plan." },
      { status: 400 },
    );
  }

  const periodEnd = body.currentPeriodEnd
    ? new Date(body.currentPeriodEnd)
    : existing?.currentPeriodEnd ?? null;

  if (periodEnd && Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Invalid period end date." }, { status: 400 });
  }

  const result = await prisma.$transaction((tx) =>
    setUserPlan(tx, {
      userId: params.id,
      tier,
      status,
      cycle: body.cycle ?? existing?.cycle ?? "MONTHLY",
      // Price comes from the catalogue, never from the request body.
      amount: TIERS[tier].price,
      currentPeriodEnd: periodEnd,
      adminId: auth.user.id,
      reason: body.reason?.trim() || "Updated by admin",
    }),
  );

  return NextResponse.json({
    ok: true,
    userId: params.id,
    tier: result.tier,
    status,
    amount: TIERS[tier].price,
    rolesGranted: result.granted,
    rolesRevoked: result.revoked,
  });
}
