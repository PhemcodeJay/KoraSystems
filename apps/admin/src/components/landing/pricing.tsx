"use client";

import { useState } from "react";
import Link from "next/link";
import { Section, SectionHeading, Check } from "./ui";
import {
  TIERS,
  TIER_ORDER,
  priceForCycle,
  limitsForTier,
  type BillingCycle,
} from "@kora/auth/entitlements";
import { APPS } from "@kora/brand";

/**
 * Pricing band.
 *
 * Renders the three subscription tiers straight from `@kora/auth/entitlements` —
 * the same table the access guards and the checkout read — so the price, the
 * cycle and the enforced caps shown here can never disagree with what actually
 * unlocks. A monthly/yearly toggle mirrors the `cycle` the checkout API accepts
 * (yearly = 10× monthly, i.e. two months free), and each card lists the real
 * per-tier limits because those caps — not the marketing bullets — are what
 * actually separate the tiers.
 *
 * A client component because the toggle is local UI state; every import here is
 * a Prisma-free pure const/function, so it is safe to ship to the browser.
 */

const CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

/** "-1 means unlimited" — shared phrasing with the in-app billing page. */
const cap = (n: number) => (n < 0 ? "Unlimited" : n.toLocaleString("en-KE"));

export function Pricing({ signedIn }: { signedIn: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const yearly = cycle === "YEARLY";

  return (
    <Section tone="white" id="pricing">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple pricing that scales with you."
        sub="Start free on SalesPilot. Add the till, then banking, as you grow. Every price is in KES."
      />

      {/* Billing-cycle toggle. The monthly equivalent is shown on the yearly
          view so the "two months free" saving is obvious, not just implied. */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div
          role="group"
          aria-label="Billing cycle"
          className="inline-flex rounded-lg border border-ink-200 bg-white p-1 shadow-sm"
        >
          {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              aria-pressed={cycle === c}
              className={
                cycle === c
                  ? "rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white"
                  : "rounded-md px-4 py-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
              }
            >
              {CYCLE_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          {yearly ? "Billed once a year — two months free" : "Billed every month"}
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const t = TIERS[tier];
          const price = priceForCycle(tier, cycle);
          const limits = limitsForTier(tier);
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
                  {price === 0 ? "Free" : `KES ${price.toLocaleString("en-KE")}`}
                </span>
                {price > 0 && (
                  <span className="text-sm text-ink-500">
                    /{yearly ? "year" : "month"}
                  </span>
                )}
              </p>
              {/* On yearly, show the effective monthly cost so the discount reads. */}
              {yearly && price > 0 && (
                <p className="mt-1 text-xs text-ink-500">
                  {`KES ${Math.round(price / 12).toLocaleString("en-KE")} / mo · two months free`}
                </p>
              )}
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
              {/* The real enforced caps — the honest tier differentiator. */}
              {limits && (
                <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-500">
                  {`${cap(limits.seats)} staff · ${cap(limits.products)} products · ${cap(limits.salesPerMonth)} sales/mo · ${cap(limits.tills)} tills`}
                </p>
              )}
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
