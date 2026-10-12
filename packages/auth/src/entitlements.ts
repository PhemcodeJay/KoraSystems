/**
 * Subscription entitlements: tier → apps and secondary roles.
 *
 * ── No Prisma import, deliberately ────────────────────────────────────────
 * The policy is declared with local string unions rather than the generated
 * `@prisma/client` enums. That keeps this module a pure function of its input,
 * so the edge runtime, the vendored Express services and a Server Component can
 * all evaluate entitlements without pulling in the Prisma client — which has
 * native bindings and cannot run on the edge at all.
 *
 * The unions are structurally identical to the Prisma enums, so Prisma's
 * generated `PlanTier` satisfies `Tier` when passed in. `assertTier` and
 * `assertStatus` below validate untrusted input (an admin form, a webhook body)
 * before it reaches a typed parameter.
 */

/** Mirrors the `kora.PlanTier` enum. */
export type Tier = "FREE" | "STANDARD" | "METAL";

/** Mirrors the `kora.SubscriptionStatus` enum (now incl. TRIALING). */
export type SubStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "TRIALING";

/** Mirrors the `kora.UserRole` enum, minus the ADMIN staff role. */
export type Role = "SME" | "SUPPLIER" | "CUSTOMER";

const ALL_TIERS: readonly Tier[] = ["FREE", "STANDARD", "METAL"];
const ALL_STATUSES: readonly SubStatus[] = [
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
  "TRIALING",
];

/** Narrow an untrusted value to a tier, or null. */
export function assertTier(value: unknown): Tier | null {
  return ALL_TIERS.includes(value as Tier) ? (value as Tier) : null;
}

/** Narrow an untrusted value to a subscription status, or null. */
export function assertStatus(value: unknown): SubStatus | null {
  return ALL_STATUSES.includes(value as SubStatus) ? (value as SubStatus) : null;
}

/**
 * Subscription entitlements: tier → apps and secondary roles.
 *
 * ── Why this is one table ─────────────────────────────────────────────────
 * Product rules were being re-implemented in three places (the plan page, the
 * nav filter and each route's role check) and they drifted. A tier that sold
 * SwiftPOS in the pricing table but not in the nav was not a bug anyone
 * noticed until a paying customer hit a locked screen. Everything now reads
 * this module, so a pricing change is a one-file edit that cannot disagree
 * with itself.
 *
 * ── Shape ─────────────────────────────────────────────────────────────────
 *   FREE     → SalesPilot                     (SME only)
 *   STANDARD → SalesPilot + SwiftPOS           (+ Supplier)
 *   METAL    → SalesPilot + SwiftPOS + Neobank (+ Customer)
 *
 * SalesPilot is the entry point because it is analytics over data the SME
 * already generates by trading — it costs nothing to serve and is the natural
 * trial. SwiftPOS adds the till and stock ledger. Neobank is last because it
 * touches customer funds and therefore carries the regulatory weight.
 */

/** The three products, keyed as they appear in `APPS`. */
export type AppKey = "salespilot" | "swiftpos" | "neobank";

export const APP_KEYS: readonly AppKey[] = ["salespilot", "swiftpos", "neobank"] as const;

/** Roles a subscription can add on top of the account's primary role. */
export type GrantableRole = Exclude<Role, "SME">;

export type TierDefinition = {
  tier: Tier;
  name: string;
  /** Monthly price in KES. The platform is Kenya-priced, so this is not USD. */
  price: number;
  /** Yearly price in KES (12× monthly minus 2 months free). Billed via M-Pesa. */
  yearlyPrice: number;
  /** Products unlocked at this tier, cheapest first. */
  apps: readonly AppKey[];
  /** Secondary roles this tier entitles, beyond the primary role. */
  roles: readonly GrantableRole[];
  /** Marketing bullets for the pricing page. */
  features: readonly string[];
  popular?: boolean;
  limits: TierLimits;
};

/**
 * Enforced SaaS caps per tier.
 *
 * `-1` means unlimited. Every cap is checked server-side before the write —
 * the UI hides the button, the API returns 402 with the tier that unlocks it.
 * Limits live here (not in the DB) so pricing changes are a one-file edit
 * that pricing page, guards and APIs all read together.
 */
export type TierLimits = {
  /** Team seats including the owner. FREE=3 honours the old "3 staff" copy. */
  seats: number;
  /** Active products the tenant may list. */
  products: number;
  /** Sales recorded per calendar month. */
  salesPerMonth: number;
  /** Tills the tenant may operate. */
  tills: number;
  /** Free trial length in days for a new tenant. 0 = no trial. */
  trialDays: number;
};

export const TIERS: Record<Tier, TierDefinition> = {
  FREE: {
    tier: "FREE",
    name: "Starter",
    price: 0,
    yearlyPrice: 0,
    apps: ["salespilot"],
    roles: [],
    features: [
      "SalesPilot analytics and forecasting",
      "Up to 3 staff accounts",
      "Community support",
    ],
    limits: { seats: 3, products: 50, salesPerMonth: 200, tills: 1, trialDays: 0 },
  },
  STANDARD: {
    tier: "STANDARD",
    name: "Growth",
    price: 2500,
    yearlyPrice: 25000,
    apps: ["salespilot", "swiftpos"],
    roles: ["SUPPLIER"],
    features: [
      "Everything in Starter",
      "SwiftPOS point of sale and stock",
      "Sell as a supplier to other businesses",
      "Unlimited staff accounts",
      "Email support",
    ],
    popular: true,
    limits: { seats: 15, products: 1000, salesPerMonth: 5000, tills: 5, trialDays: 90 },
  },
  METAL: {
    tier: "METAL",
    name: "Enterprise",
    price: 7500,
    yearlyPrice: 75000,
    apps: ["salespilot", "swiftpos", "neobank"],
    roles: ["SUPPLIER", "CUSTOMER"],
    features: [
      "Everything in Growth",
      "Neobank accounts, cards and credit",
      "Buy on credit as a customer",
      "Dedicated account manager",
    ],
    limits: { seats: -1, products: -1, salesPerMonth: -1, tills: -1, trialDays: 90 },
  },
};

/** Display order, cheapest first. Drives the pricing page and upgrade prompts. */
export const TIER_ORDER: readonly Tier[] = ["FREE", "STANDARD", "METAL"] as const;

/**
 * Statuses that still entitle the user to what they paid for.
 *
 * PAST_DUE is a grace period: the account keeps working while billing is
 * chased. CANCELLED and EXPIRED revoke access but keep the tier recorded, so
 * the UI can say "your Enterprise plan ended" rather than pretending the user
 * is on Starter. TRIALING behaves like ACTIVE until `trialEndsAt` — a trial
 * that lapsed is treated as EXPIRED by the tenant resolver, not here.
 */
const ACCESS_STATUSES: readonly SubStatus[] = ["ACTIVE", "PAST_DUE", "TRIALING"];

export function statusGrantsAccess(status: SubStatus | null | undefined): boolean {
  return !!status && ACCESS_STATUSES.includes(status);
}

/** Apps unlocked by a tier, ignoring billing status. */
export function appsForTier(tier: Tier | null | undefined): readonly AppKey[] {
  return (tier && TIERS[tier]?.apps) || [];
}

/** Secondary roles a tier entitles, ignoring billing status. */
export function rolesForTier(tier: Tier | null | undefined): readonly GrantableRole[] {
  return (tier && TIERS[tier]?.roles) || [];
}
export type Entitlements = {
  tier: Tier | null;
  status: SubStatus | null;
  /** True when billing status permits access at all. */
  active: boolean;
  /** Apps the user may open right now. */
  apps: readonly AppKey[];
  /** Apps the tier would unlock once billing is settled. */
  appsEntitled: readonly AppKey[];
  /** Secondary roles currently granted. */
  roles: readonly GrantableRole[];
  locked: readonly AppKey[];
  /** The cheapest tier that would unlock `app`, for the upgrade prompt. */
  requiredTierFor: (app: AppKey) => TierDefinition | null;
};

/**
 * Resolve what a user can reach from their plan.
 *
 * `roles` is passed in rather than queried here, so this stays a pure function
 * and can be called from the edge, the admin console and a Server Component
 * without touching the database.
 *
 * The distinction between `apps` and `appsEntitled` is what the UI needs: a
 * PAST_DUE Enterprise user should still *see* they have Enterprise, with a
 * "settle your bill" banner, rather than having the products silently vanish.
 */
export function resolveEntitlements(input: {
  tier?: Tier | null;
  status?: SubStatus | null;
  roles?: readonly GrantableRole[];
}): Entitlements {
  const tier = input.tier ?? null;
  const status = input.status ?? null;
  const entitled = appsForTier(tier);
  const active = statusGrantsAccess(status);

  return {
    tier,
    status,
    active,
    apps: active ? entitled : [],
    appsEntitled: entitled,
    roles: active ? (input.roles ?? []) : [],
    locked: APP_KEYS.filter((a) => !entitled.includes(a)),
    requiredTierFor: (app: AppKey) =>
      TIER_ORDER.map((t) => TIERS[t]).find((t) => t.apps.includes(app)) ?? null,
  };
}

/** True when `app` is in `apps`. */
export function canAccessApp(apps: readonly AppKey[], app: AppKey): boolean {
  return apps.includes(app);
}

/**
 * The minimal shape a route needs to gate one app.
 *
 * Accepting this rather than a full `Entitlements` keeps the guard usable from
 * an Express middleware in the vendored services, which do not import Prisma
 * types.
 */
export type AppAccessInput = {
  tier?: Tier | null;
  status?: SubStatus | null;
};

export function appAccess(input: AppAccessInput, app: AppKey): boolean {
  if (!statusGrantsAccess(input.status)) return false;
  return appsForTier(input.tier).includes(app);
}

/**
 * SaaS tier caps, for limit enforcement and upgrade prompts.
 *
 * `-1` means unlimited. Returns null for an unknown tier so callers degrade
 * to "no access" instead of throwing inside a page render.
 */
export function limitsForTier(tier: Tier | null | undefined): TierLimits | null {
  return (tier && TIERS[tier]?.limits) ?? null;
}

/** True when `used` has hit an enforced cap (`-1` never caps). */
export function isAtLimit(limit: number, used: number): boolean {
  return limit >= 0 && used >= limit;
}

/** Billing cadences the tenant checkout accepts. Mirrors `BillingCycle`. */
export const BILLING_CYCLES = ["MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export function assertCycle(value: unknown): BillingCycle | null {
  return (BILLING_CYCLES as readonly string[]).includes(value as string)
    ? (value as BillingCycle)
    : null;
}

/** Price for a tier on a cycle. Yearly = 10× monthly (2 months free). */
export function priceForCycle(tier: Tier, cycle: BillingCycle): number {
  const def = TIERS[tier];
  return cycle === "YEARLY" ? def.yearlyPrice : def.price;
}

