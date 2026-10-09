import Link from "next/link";
import { Section, SectionHeading, Check } from "./ui";
import { TIERS, TIER_ORDER } from "@kora/auth/entitlements";
import { APPS } from "@kora/brand";

/**
 * Pricing band.
 *
 * Renders the three subscription tiers straight from `@kora/auth/entitlements` —
 * the same table the access guards read — so the price and product list shown
 * here can never disagree with what actually unlocks. Prices are monthly KES,
 * as the platform is Kenya-priced.
 */
export function Pricing({ signedIn }: { signedIn: boolean }) {
  return (
    <Section tone="white" id="pricing">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple pricing that scales with you."
        sub="Start free on SalesPilot. Add the till, then banking, as you grow. Every price is monthly, in KES."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const t = TIERS[tier];
          return (
            <article
              key={tier}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                t.popular ? "border-brand-500 ring-2 ring-brand-500/20" : "border-ink-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink-900">{t.name}</h3>
                {t.popular && (
                  <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tabular-nums text-ink-900">
                  {t.price === 0 ? "Free" : `KES ${t.price.toLocaleString("en-KE")}`}
                </span>
                {t.price > 0 && <span className="text-sm text-ink-500">/month</span>}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {t.apps.map((appKey) => (
                  <span
                    key={appKey}
                    className="rounded-md bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700"
                  >
                    {APPS[appKey].name}
                  </span>
                ))}
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-600">
                {t.features.map((f) => (
                  <Check key={f}>{f}</Check>
                ))}
              </ul>
              <Link
                href={signedIn ? "/plans" : "/register"}
                className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                  t.popular
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-ink-300 bg-white text-ink-800 hover:bg-ink-50"
                }`}
              >
                {t.price === 0
                  ? "Start for free"
                  : signedIn
                    ? `Choose ${t.name}`
                    : `Start ${t.name} trial`}
              </Link>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
