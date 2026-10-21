import type { Prisma } from "@kora/database";
import { TIERS, isAtLimit, limitsForTier, type Tier } from "./entitlements";

type Db = Prisma.TransactionClient;

type CountDelegate = { count(args: unknown): Promise<number> };
type TenantDb = Db & {
  smeMember?: CountDelegate;
  product?: CountDelegate;
  sale?: CountDelegate;
  till?: CountDelegate;
};

/** Usage snapshot the limit guards check before a write. */
export type TenantUsage = {
  seatsUsed: number;
  seatsLimit: number;
  productsUsed: number;
  productsLimit: number;
  salesThisMonth: number;
  salesLimit: number;
  tillsUsed: number;
  tillsLimit: number;
};

export async function getTenantUsage(
  db: Db,
  smeId: string,
  tier: Tier,
): Promise<TenantUsage> {
  const limits = limitsForTier(tier) ?? limitsForTier("FREE")!;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const tdb = db as TenantDb;
  const safeCount = async (d: CountDelegate | undefined, args: unknown) => {
    if (!d) return 0;
    try {
      return await d.count(args);
    } catch {
      return 0;
    }
  };
  const [seatsUsed, productsUsed, salesThisMonth, tillsUsed] = await Promise.all([
    safeCount(tdb.smeMember, { where: { smeId, isActive: true } }),
    db.product.count({ where: { smeId, isActive: true } }),
    db.sale.count({ where: { smeId, soldAt: { gte: monthStart } } }),
    db.till.count({ where: { smeId } }),
  ]);
  return {
    seatsUsed,
    seatsLimit: limits.seats,
    productsUsed,
    productsLimit: limits.products,
    salesThisMonth,
    salesLimit: limits.salesPerMonth,
    tillsUsed,
    tillsLimit: limits.tills,
  };
}

export type LimitCheck =
  | { ok: true }
  | { ok: false; error: string; resource: string; limit: number; used: number; upgradeTo: Tier };

/** Assert the tenant may add one more unit of `resource`. */
export function limitExceeded(
  tier: Tier,
  resource: "seats" | "products" | "sales" | "tills",
  used: number,
): LimitCheck {
  const limits = limitsForTier(tier);
  if (!limits) return { ok: true };
  const cap =
    resource === "seats"
      ? limits.seats
      : resource === "products"
        ? limits.products
        : resource === "sales"
          ? limits.salesPerMonth
          : limits.tills;
  if (!isAtLimit(cap, used)) return { ok: true };
  const order: Tier[] = ["FREE", "STANDARD", "METAL"];
  const upgradeTo =
    order.find((t) => {
      if (order.indexOf(t) <= order.indexOf(tier)) return false;
      const l = limitsForTier(t)!;
      const c =
        resource === "seats"
          ? l.seats
          : resource === "products"
            ? l.products
            : resource === "sales"
              ? l.salesPerMonth
              : l.tills;
      return c < 0 || c > cap;
    }) ?? "METAL";
  const label =
    resource === "seats"
      ? "staff seats"
      : resource === "products"
        ? "products"
        : resource === "sales"
          ? "sales this month"
          : "tills";
  return {
    ok: false,
    error: `Your ${TIERS[tier].name} plan allows ${cap} ${label}. Upgrade to ${TIERS[upgradeTo].name} for more.`,
    resource,
    limit: cap,
    used,
    upgradeTo,
  };
}
