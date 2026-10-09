import { NextResponse } from "next/server";
import { withAuth } from "@kora/auth";
import {
  TIERS,
  TIER_ORDER,
  assertStatus,
  assertTier,
  resolveEntitlements,
} from "@kora/auth/entitlements";

/**
 * The pricing table, and the signed-in user's place on it.
 *
 * This route replaces one that read `user.plan` and `prisma.cryptoWallet`.
 * Neither exists: the model is `UserPlan` (one row per user, `tier`), and there
 * is no CryptoWallet table at all. The old handler also exported `GETUserPlan`
 * and `POSTUpgrade` from a `route.ts` — Next.js only routes `GET`, `POST`,
 * `PUT`, `PATCH` and `DELETE`, so those two were dead code that the nav linked
 * to as if they worked.
 *
 * The catalogue comes from `@kora/auth/entitlements`, the same module the
 * access guards read. A tier can no longer be advertised here and enforced
 * differently there.
 */
export async function GET() {
  const auth = await withAuth("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const plans = TIER_ORDER.map((tier) => {
    const t = TIERS[tier];
    return {
      tier: t.tier,
      name: t.name,
      price: t.price,
      apps: t.apps,
      roles: t.roles,
      features: t.features,
      popular: !!t.popular,
    };
  });

  // The signed-in user's own entitlements. Returned from the same request so
  // the pricing page can highlight the current plan and grey out what it does
  // not include, rather than making a second round trip that can disagree.
  // The session carries tier/status as plain strings, since the cookie type is
  // a stable contract. Narrow them here rather than casting: a stale session
  // pointing at a tier that no longer exists degrades to "no entitlements"
  // instead of throwing inside a page render.
  const entitlements = resolveEntitlements({
    tier: assertTier(auth.user.planTier),
    status: assertStatus(auth.user.planStatus),
  });

  return NextResponse.json({
    plans,
    current: {
      tier: entitlements.tier,
      status: entitlements.status,
      apps: entitlements.apps,
      roles: entitlements.roles,
      locked: entitlements.locked,
    },
  });
}
