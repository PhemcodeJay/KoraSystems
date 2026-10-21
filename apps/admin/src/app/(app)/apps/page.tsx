import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import {
  APP_KEYS,
  TIERS,
  TIER_ORDER,
  assertStatus,
  assertTier,
  resolveEntitlements,
  type AppKey,
} from "@kora/auth/entitlements";
import { APPS, BRAND } from "@kora/brand";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your apps" };

/** Where each product is entered once the hub opens it. */
const APP_ENTRY: Record<AppKey, { href: string; blurb: string }> = {
  salespilot: {
    href: "/sme/sales",
    blurb: "Forecasts, trends and insights from your trading history.",
  },
  swiftpos: {
    href: "/pos",
    blurb: "Run the till, take payments and keep stock accurate.",
  },
  neobank: {
    href: "/neobank",
    blurb: "Business accounts, cards, savings and SME credit.",
  },
};

/**
 * The app hub — the user's control panel over the three products.
 *
 * ── Why a hub rather than one flat nav ────────────────────────────────────
 * The products are sold separately, so access is a function of subscription,
 * not role. A single nav had to either show everything and lie about what was
 * clickable, or hide items and leave a user unable to discover that an upgrade
 * exists. This page is explicit about all three: open, locked, and which plan
 * opens it.
 *
 * Entitlements come from the same `@kora/auth/entitlements` table the server
 * guards read, so this page cannot advertise a product the API would refuse.
 * A locked tile renders with no link at all, rather than a link that 402s, so
 * there is no dead end to click into.
 */
export default async function AppsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Staff are not subscribers, so they are not gated by a plan. Treating an
  // admin as tierless would lock the console out of its own products.
  const isStaff = user.role === "ADMIN";

  const entitlements = resolveEntitlements({
    tier: isStaff ? "METAL" : assertTier(user.planTier),
    status: isStaff ? "ACTIVE" : assertStatus(user.planStatus),
  });

  const tier = isStaff ? assertTier("METAL") : assertTier(user.planTier);
  const current = tier ? TIERS[tier] : null;
  const unlocked = [...entitlements.apps];

  // The next tier up, if the account is not already on the top one.
  const upgrade =
    tier && TIER_ORDER.indexOf(tier) < TIER_ORDER.length - 1
      ? TIERS[TIER_ORDER[TIER_ORDER.indexOf(tier) + 1]]
      : null;

  const overdue = !isStaff && user.planStatus === "PAST_DUE";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Your apps</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {user.fullName} &middot; {current ? `${current.name} plan` : "No plan yet"}
        </p>
      </div>

      {overdue && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Your last payment has not cleared.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Your apps stay available while we wait, but access is suspended if
            the invoice goes unpaid.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {APP_KEYS.map((key) => {
          const app = APPS[key];
          const open = unlocked.includes(key);
          const required = entitlements.requiredTierFor(key);
          const entry = APP_ENTRY[key];

          return (
            <Card
              key={key}
              className={open ? "" : "bg-ink-50/60"}
              title={app.name}
              hint={open ? entry.blurb : `Included from the ${required?.name} plan`}
            >
              {open ? (
                <Link
                  href={entry.href}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Open {app.name}
                </Link>
              ) : (
                <div className="space-y-2">
                  <Badge className="bg-ink-100 text-ink-600 ring-ink-300/40">
                    Locked
                  </Badge>
                  <p className="text-xs text-ink-500">
                    Requires {required?.name} &middot; KES{" "}
                    {required?.price.toLocaleString()}/month
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {upgrade && (
        <Card title="Get more" hint={`Next plan up from ${current?.name}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink-900">{upgrade.name}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-600">
                {upgrade.features.map((f) => (
                  <li key={f}>&middot; {f}</li>
                ))}
              </ul>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-ink-900">
                KES {upgrade.price.toLocaleString()}
              </p>
              <p className="text-xs text-ink-500">per month</p>
              <Link
                href="/plans"
                className="mt-2 inline-block rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </Card>
      )}

      <Card title="Your roles" hint="Granted by your subscription tier">
        <ul className="space-y-1 text-sm text-ink-700">
          <li>&middot; Primary: {user.role.toLowerCase()}</li>
          {user.grantedRoles?.map((r) => (
            <li key={r}>&middot; Also active as {r.toLowerCase()}</li>
          ))}
          {(!user.grantedRoles || user.grantedRoles.length === 0) && (
            <li className="text-ink-400">&middot; No additional roles on this plan</li>
          )}
        </ul>
        <p className="mt-3 text-xs text-ink-500">
          Downgrading removes extra roles but never deletes your trading history.
        </p>
      </Card>

      <p className="text-xs text-ink-400">
        {BRAND.legalEntity} &middot; {BRAND.tagline}
      </p>
    </div>
  );
}
