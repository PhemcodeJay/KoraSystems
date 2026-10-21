import { getSessionUser } from "@kora/auth/guards";
import {
  TIERS,
  TIER_ORDER,
  assertStatus,
  assertTier,
  resolveEntitlements,
} from "@kora/auth/entitlements";
import { APPS } from "@kora/brand";
import { Badge, Card } from "@/components/ui";
import { StartPlanButton } from "./start-plan-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans" };

const fmtKES = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

/**
 * The pricing page.
 *
 * The nav linked here before this file existed — `/neobank/plans` was a dead
 * 404, because the tier logic had been added to `api/plans/route.ts` as
 * exports Next.js does not route. The table comes from
 * `@kora/auth/entitlements`, the same source the access guards use, so the
 * price advertised here is the price that decides what unlocks.
 *
 * Upgrades are self-serve *trials*, never self-applied paid tiers. Starting a
 * plan calls `/api/billing/checkout`, which opens a time-boxed TRIALING
 * subscription (capped at Growth, so no one self-serves into Neobank). A paid
 * tier still only activates through the M-Pesa callback or an admin — a forged
 * POST can at most start a trial that expires on its own, never grant a paid
 * money-touching plan.
 */
export default async function PlansPage() {
  const user = await getSessionUser();

  // Staff are not subscribers and are not gated by a plan.
  const isStaff = user?.role === "ADMIN";

  const entitlements = resolveEntitlements({
    tier: isStaff ? assertTier("METAL") : assertTier(user?.planTier),
    status: isStaff ? "ACTIVE" : assertStatus(user?.planStatus),
  });

  const currentTier = isStaff ? assertTier("METAL") : assertTier(user?.planTier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Plans</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Choose which of the three products your business can use.
        </p>
      </div>

      {entitlements.locked.length > 0 && currentTier && (
        <Card title="Your access" hint={`Currently on ${TIERS[currentTier].name}`}>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Open
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {entitlements.apps.length === 0 ? (
                  <span className="text-sm text-ink-400">Nothing yet</span>
                ) : (
                  entitlements.apps.map((a) => (
                    <Badge
                      key={a}
                      className="bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    >
                      {APPS[a].name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Locked
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {entitlements.locked.map((a) => {
                  const req = entitlements.requiredTierFor(a);
                  return (
                    <Badge
                      key={a}
                      className="bg-ink-100 text-ink-600 ring-ink-300/40"
                    >
                      {APPS[a].name} &middot; needs {req?.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          {user?.planStatus === "PAST_DUE" && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your payment is overdue. Access stays open while the invoice
              clears.
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const t = TIERS[tier];
          const isCurrent = currentTier === tier;

          return (
            <Card
              key={tier}
              className={isCurrent ? "ring-2 ring-brand-500" : ""}
              title={t.name}
              hint={
                t.price === 0
                  ? "Free"
                  : `${fmtKES(t.price)} / mo · ${fmtKES(t.yearlyPrice)} / yr`
              }
            >
              {t.popular && (
                <Badge className="mb-2 bg-brand-50 text-brand-800 ring-brand-500/30">
                  Most popular
                </Badge>
              )}

              <p className="text-3xl font-semibold tabular-nums text-ink-900">
                {t.price === 0 ? "Free" : fmtKES(t.price)}
              </p>
              {t.price > 0 && (
                <p className="mt-0.5 text-xs text-ink-500">
                  {`or ${fmtKES(t.yearlyPrice)} / year — two months free`}
                </p>
              )}

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-500">
                Apps
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {t.apps.map((a) => (
                  <Badge key={a}>{APPS[a].name}</Badge>
                ))}
              </div>
              {/* Enforced caps — same source as the guards and the billing page. */}
              <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
                {`${t.limits.seats < 0 ? "Unlimited" : t.limits.seats} staff · ${t.limits.products < 0 ? "unlimited" : t.limits.products} products · ${t.limits.salesPerMonth < 0 ? "unlimited" : t.limits.salesPerMonth} sales/mo · ${t.limits.tills < 0 ? "unlimited" : t.limits.tills} tills`}
              </p>

              {t.roles.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-500">
                    Also act as
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.roles.map((r) => (
                      <Badge
                        key={r}
                        className="bg-brand-50 text-brand-800 ring-brand-500/30"
                      >
                        {r.toLowerCase()}
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              <ul className="mt-4 space-y-1.5 text-sm text-ink-600">
                {t.features.map((f) => (
                  <li key={f}>&middot; {f}</li>
                ))}
              </ul>

              {isCurrent ? (
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-center text-sm font-medium text-brand-800">
                  Your current plan
                </p>
              ) : user ? (
                <StartPlanButton
                  tier={tier}
                  cycle="MONTHLY"
                  label={`Start ${t.name} trial`}
                />
              ) : (
                <a
                  href="/register"
                  className="mt-4 block rounded-lg border border-ink-300 px-3 py-2 text-center text-sm font-medium text-ink-700 hover:bg-ink-100"
                >
                  Create an account
                </a>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-ink-400">
        Starting a plan opens a free trial that lasts for the days shown on each
        plan. Paid plans activate once payment clears. Downgrading removes extra
        roles but never deletes your trading history.
      </p>
    </div>
  );
}
