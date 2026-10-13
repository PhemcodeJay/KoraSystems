import { Section, Container } from "./ui";
import { KoraLogo, APPS, type KoraMarkVariant } from "@kora/brand";

/**
 * Problem → solution pivot band — the hinge of the page.
 *
 * Takes each gap named in the Problem band and answers it with the product
 * built to close it: SalesPilot for visibility and forecasting, Neobank for one
 * ledger and credit, SwiftPOS for a till that works on the shop floor. A gap
 * that genuinely spans two products — credit needs a score *and* a loan — shows
 * both, so the platform reads as connected rather than as three separate apps.
 *
 * Uses the `dark` section tone so it breaks the light rhythm of the bands
 * around it and reads as a beat, not another feature card.
 */

type ProductRef = {
  key: "swiftpos" | "salespilot" | "neobank";
  variant: KoraMarkVariant;
};

type Fix = {
  problem: string;
  /** The product(s) that close this gap, badged with their real brand mark. */
  products: ProductRef[];
  solution: string;
};

const FIXES: Fix[] = [
  {
    problem: "You're flying blind",
    products: [{ key: "salespilot", variant: "gold" }],
    solution:
      "SalesPilot turns every sale into a live view of profit, stock and demand — and forecasts what will sell before you order.",
  },
  {
    problem: "Good business, invisible to lenders",
    products: [
      { key: "salespilot", variant: "gold" },
      { key: "neobank", variant: "blue" },
    ],
    solution:
      "Your real sales become a credit score in SalesPilot, then a working-capital loan you can draw on in Neobank. No collateral.",
  },
  {
    problem: "Ten tools that don't talk",
    products: [
      { key: "swiftpos", variant: "green" },
      { key: "neobank", variant: "blue" },
    ],
    solution:
      "One account and one balanced ledger across the till, payments, suppliers and lending — nothing to reconcile by hand.",
  },
  {
    problem: "Software built for someone else",
    products: [{ key: "swiftpos", variant: "green" }],
    solution:
      "SwiftPOS is mobile-first and offline-first, M-Pesa native — it runs on the phone in your shop, not a desktop in an office.",
  },
];

export function Statement() {
  return (
    <Section tone="dark">
      <Container className="text-center">
        <p className="mx-auto max-w-3xl text-2xl font-bold leading-snug sm:text-3xl">
          SwiftPOS, SalesPilot and Neobank — the missing operating system for
          your shop.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-300">
          Every gap above has an answer, and each is closed by the product built
          for it. Here’s which one does what.
        </p>

        <dl className="mx-auto mt-10 grid max-w-4xl gap-x-8 gap-y-6 text-left sm:grid-cols-2">
          {FIXES.map((f) => (
            <div
              key={f.problem}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400 line-through decoration-danger/60">
                {f.problem}
              </dt>

              {/* Product badge(s) — the mark colour names the product at a
                  glance: green SwiftPOS, gold SalesPilot, blue Neobank. */}
              <div className="mt-3 flex flex-wrap gap-2">
                {f.products.map((p) => (
                  <span
                    key={p.key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/10"
                  >
                    <KoraLogo size={16} rounded={4} variant={p.variant} />
                    {APPS[p.key].name}
                  </span>
                ))}
              </div>

              <dd className="mt-3 flex gap-2 text-base font-medium text-white">
                <span aria-hidden className="mt-0.5 text-brand-400">
                  ✓
                </span>
                <span>{f.solution}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
