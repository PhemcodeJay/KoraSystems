import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import { ROLE_LABELS } from "@kora/brand";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";
import {
  TIERS,
  TIER_ORDER,
  resolveEntitlements,
  type AppKey,
} from "./entitlements";

/**
 * Read the current user from the signed cookie, then re-load from the
 * database so role changes, deactivations and plan downgrades apply
 * immediately. Returns null when signed out, expired, or the user no longer
 * exists.
 *
 * The cookie carries only `{userId, role, exp}` — deliberately. Billing state
 * and granted roles are read fresh here instead, because a downgrade that only
 * took effect at next sign-in would leave a cancelled customer inside the
 * product they just stopped paying for for up to eight hours.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      plan: { select: { tier: true, status: true } },
      roleAssignments: {
        where: { revokedAt: null },
        select: { role: true },
      },
      sme: { select: { id: true } },
      supplier: { select: { id: true } },
      customer: { select: { id: true } },
    },
  });

  if (!user || !user.isActive) return null;

  // A granted role is only *usable* when a profile row exists behind it.
  // Without this, an Enterprise SME with no supplier record would be shown
  // "Orders" in the navigation and land on "No supplier is linked to this
  // account" — the same dead end, moved from the guard to the menu.
  const usable = new Set<SessionUser["role"]>([user.role]);
  if (user.sme) usable.add("SME");
  if (user.supplier) usable.add("SUPPLIER");
  if (user.customer) usable.add("CUSTOMER");

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    planTier: user.plan?.tier,
    planStatus: user.plan?.status,
    grantedRoles: user.roleAssignments.map((a) => a.role),
    usableRoles: [...usable],
    mustChangePassword: user.mustChangePassword,
  };
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Assert the signed-in user holds one of `roles`.
 *
 * Every protected read and action must call this server-side. Client-side
 * checks are for routing only and are never a security boundary.
 *
 * NOTE: this THROWS rather than returning null. Callers must `await` it and
 * convert the rejection into a response — see `withAuth`, which is the only
 * sanctioned way to guard a route handler.
 */
export async function requireRole(
  ...roles: SessionUser["role"][]
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ForbiddenError("Sign in to continue.");
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(
      `This area is for ${roles.join(" or ").toLowerCase()} accounts.`,
    );
  }
  return user;
}

/**
 * Route-handler guard. Returns the user, or a ready-to-return error response.
 *
 * Use this in API routes instead of calling `requireRole` directly:
 *
 *     const auth = await withAuth("SME", "ADMIN");
 *     if (auth.response) return auth.response;
 *     const { user } = auth;
 *
 * `requireRole` is async and throws, so a bare `const ctx = requireRole(...)`
 * assigns a *Promise* — always truthy — and the guard silently never fires,
 * letting any signed-in role through. This helper removes that footgun.
 */
export async function withAuth(
  ...roles: SessionUser["role"][]
): Promise<
  | { user: SessionUser; response?: undefined }
  | { user?: undefined; response: NextResponse }
> {
  try {
    const user = await requireRole(...roles);
    return { user };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      const status = error.message === "Sign in to continue." ? 401 : 403;
      return { response: NextResponse.json({ error: error.message }, { status }) };
    }
    throw error;
  }
}

/**
 * The signed-in user plus the tenant key that owns their data.
 *
 * Without this, a read endpoint guarded only by `withAuth` still leaks every
 * tenant's rows — a signed-in SME would see other businesses' sales. Resolve
 * the owning key once, then filter the query by it.
 *
 * `isAdmin` is the only role allowed to see across tenants.
 *
 * ── Several ids can be set at once ────────────────────────────────────────
 * An SME on a paid tier also sells as a supplier and buys as a customer, so
 * this is no longer an either/or chain: each id is resolved independently from
 * the user's *granted* roles. The old `else if` could only ever populate one,
 * which is why a dual-role user could not reach their supplier pages at all.
 * `roles` is the authoritative list — `user.role` alone is not, since a
 * secondary role is granted by subscription, not stored on the user row.
 */
export type Scope = {
  user: SessionUser;
  isAdmin: boolean;
  /** Every role the user currently holds, primary plus granted. */
  roles: SessionUser["role"][];
  /** True when the user holds this role, by any path. */
  hasRole: (role: SessionUser["role"]) => boolean;
  /** SME id — set when the user acts as an SME. */
  smeId?: string;
  /** Supplier id — set when the user acts as a supplier. */
  supplierId?: string;
  /** Customer id — set when the user acts as a customer. */
  customerId?: string;
  /** Tier, status and unlocked apps, for entitlement-gated surfaces. */
  tier?: string;
  planStatus?: string;
  apps: readonly AppKey[];
};

/**
 * Resolve the signed-in user's full role set and tenant ids.
 *
 * `roles` narrows the accepted roles; ADMIN always resolves regardless, since
 * an admin can reach every section by definition.
 *
 * Granted roles come from `user_role_assignments`, filtered on `revokedAt IS
 * NULL` — a revoked role is history, not access. Revoked rows are deliberately
 * kept rather than deleted so the admin view can show what was sold and when.
 */
export async function requireScope(...roles: SessionUser["role"][]): Promise<Scope> {
  const user = await requireRole("ADMIN", ...roles);

  const [profile, assignments, plan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        sme: { select: { id: true } },
        supplier: { select: { id: true } },
        customer: { select: { id: true } },
      },
    }),
    prisma.userRoleAssignment.findMany({
      where: { userId: user.id, revokedAt: null },
      select: { role: true },
    }),
    prisma.userPlan.findUnique({
      where: { userId: user.id },
      select: { tier: true, status: true },
    }),
  ]);

  // Primary role first, then granted roles. De-duplicated so a granted role
  // that happens to equal the primary does not appear twice in the nav.
  const effective = Array.from(
    new Set<SessionUser["role"]>([user.role, ...assignments.map((a) => a.role)]),
  );

  const entitlements = resolveEntitlements({
    tier: plan?.tier,
    status: plan?.status,
  });

  return {
    user,
    isAdmin: user.role === "ADMIN",
    roles: effective,
    hasRole: (role) => effective.includes(role),
    // An id is only exposed for a role the user actually holds, so a stale
    // profile row cannot grant access on its own.
    smeId: effective.includes("SME") ? profile?.sme?.id : undefined,
    supplierId: effective.includes("SUPPLIER") ? profile?.supplier?.id : undefined,
    customerId: effective.includes("CUSTOMER") ? profile?.customer?.id : undefined,
    tier: plan?.tier ?? undefined,
    planStatus: plan?.status ?? undefined,
    apps: entitlements.apps,
  };
}

/**
 * Gate a route behind one of the three products' entitlements.
 *
 * Throws rather than returning null, matching `requireRole`, so callers cannot
 * accidentally treat a rejected user as authorised. Callers must await it and
 * convert the rejection into a response via `withAppAccess`.
 */
export async function requireApp(app: AppKey): Promise<Scope> {
  const scope = await requireScope("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (scope.isAdmin) return scope;
  if (scope.apps.includes(app)) return scope;

  const required = TIERS[
    (TIER_ORDER.find((t) => TIERS[t].apps.includes(app)) ?? "FREE")
  ];
  throw new ForbiddenError(
    `${required.name} plan required for ${app}. Upgrade to unlock it.`,
  );
}

/**
 * The profile the user acts through, or throw.
 *
 * ── Why these honour GRANTED roles, not just the primary one ───────────────
 * These used to call `requireRole("SME")`, which tests the single `User.role`
 * column. That made the subscription's secondary roles decorative: a METAL SME
 * is *granted* SUPPLIER, but `requireSupplier()` still rejected them, and the
 * `/customer` layout — which required CUSTOMER alone — redirected them away
 * entirely. The tier sold roles the product then refused to open.
 *
 * Now each guard asks `requireScope` for the ids it resolves from the user's
 * full role set. A role is reached only if the user actually holds it AND has a
 * profile row behind it, so a granted role without data yields the same clear
 * "no profile linked" message instead of a confusing empty page.
 *
 * The narrow `requireScope("ADMIN", ...)` call is deliberate: it authorises any
 * signed-in user and lets the profile check below do the discriminating. Passing
 * one specific role here would reintroduce exactly the bug being fixed.
 */
async function requireProfile(
  role: "SME" | "SUPPLIER" | "CUSTOMER",
): Promise<Scope> {
  const scope = await requireScope("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (!scope.hasRole(role)) {
    throw new ForbiddenError(
      `This area is for ${ROLE_LABELS[role].toLowerCase()} accounts.`,
    );
  }
  return scope;
}

/** The SME record for the signed-in user, or throw. */
export async function requireSme() {
  const scope = await requireProfile("SME");
  const sme = scope.smeId
    ? await prisma.sME.findUnique({ where: { id: scope.smeId } })
    : null;
  if (!sme) throw new ForbiddenError("No business is linked to this account.");
  return { user: scope.user, sme };
}

export async function requireSupplier() {
  const scope = await requireProfile("SUPPLIER");
  const supplier = scope.supplierId
    ? await prisma.supplier.findUnique({ where: { id: scope.supplierId } })
    : null;
  if (!supplier) throw new ForbiddenError("No supplier is linked to this account.");
  return { user: scope.user, supplier };
}

export async function requireCustomer() {
  const scope = await requireProfile("CUSTOMER");
  const customer = scope.customerId
    ? await prisma.customer.findUnique({ where: { id: scope.customerId } })
    : null;
  if (!customer) {
    throw new ForbiddenError("No customer profile is linked to this account.");
  }
  return { user: scope.user, customer };
}

/**
 * Entitlement gate for route handlers, mirroring `withAuth`.
 *
 * Same footgun as `requireApp` avoided: `requireApp` is async and throws, so a
 * bare `const ctx = requireApp("neobank")` would assign a Promise — always
 * truthy — and the guard would silently never fire. Use this instead.
 *
 * 402 rather than 403 for a locked product: the request was well-formed and
 * correctly authenticated, and the way to fix it is to buy a plan, not to ask
 * for different credentials.
 */
export async function withAppAccess(
  app: AppKey,
): Promise<
  | { scope: Scope; response?: undefined }
  | { scope?: undefined; response: NextResponse }
> {
  try {
    const scope = await requireApp(app);
    return { scope };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      const status = error.message === "Sign in to continue." ? 401 : 402;
      return { response: NextResponse.json({ error: error.message }, { status }) };
    }
    throw error;
  }
}

/**
 * Where each role lands after signing in.
 *
 * ADMIN gets the platform console overview. SME, SUPPLIER and CUSTOMER land on
 * /home, the role dispatcher that renders their dashboard; CUSTOMER lands on
 * the shop, which is their primary surface. `/` stays the public landing page.
 *
 * The app hub is the default landing for anyone whose plan unlocks more than
 * one product, since the hub is where they choose between them.
 */
export const HOME_FOR_ROLE: Record<SessionUser["role"], string> = {
  ADMIN: "/admin/overview",
  SME: "/home",
  SUPPLIER: "/home",
  CUSTOMER: "/customer/shop",
};

/** The app hub. Kept as a constant so nav and redirects cannot disagree. */
export const APP_HUB_PATH = "/apps";

