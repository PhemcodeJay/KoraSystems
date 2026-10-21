import Link from "next/link";
import { Section, SectionHeading, Check } from "./ui";
import { KoraLogo, APPS, type KoraMarkVariant } from "@kora/brand";

/**
 * Products band.
 *
 * Introduces the three flagship products — SwiftPOS, SalesPilot and Neobank —
 * each in its brand mark variant (green, gold, blue) with a short feature list.
 * Copy and links adapt to whether the visitor is signed in: a signed-in user
 * goes to the real surface, a visitor is asked to sign in first.
 */

type ProductKey = "swiftpos" | "salespilot" | "neobank";

const PRODUCTS: {
  key: ProductKey;
  variant: KoraMarkVariant;
  /** The problem this product exists to close, shown as the card's eyebrow. */
  solves: string;
  bullets: string[];
  signedInHref: string;
}[] = [
  {
    key: "swiftpos",
    variant: "green",
    solves: "Records sales and stock",
    bullets: [
      "Browser-based point of sale",
      "Product catalogue and stock control",
      "Sales recorded to the shared ledger",
    ],
    signedInHref: "/pos",
  },
  {
    key: "salespilot",
    variant: "gold",
    solves: "Shows what sells, and proves it",
    bullets: [
      "Sales analytics that show what actually moves",
      "Sales-based demand forecasts and restock estimates",
      "Explainable credit decision support for human review",
    ],
    signedInHref: "/sme/sales",
  },
  {
    key: "neobank",
    variant: "blue",
    solves: "Tracks business money",
    bullets: [
      "Business wallet and one balanced ledger",
      "Loan applications stay in human review",
      "Disbursement is simulated until a licensed partner is configured",
    ],
    signedInHref: "/payments",
  },
];

export function Products({ signedIn }: { signedIn: boolean }) {
  return (
    <Section id="products">
      <SectionHeading
        eyebrow="Products"
        title="Three products. One platform."
        sub="Each product closes a gap — SwiftPOS sells, SalesPilot shows, Neobank moves the money — on one account, one ledger and one sign-in."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PRODUCTS.map((p) => {
          const app = APPS[p.key];
          return (
            <article
              key={p.key}
              className="flex flex-col rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <KoraLogo size={44} rounded={11} variant={p.variant} />
                <div>
                  <h3 className="text-lg font-semibold text-ink-900">{app.name}</h3>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                    {p.solves}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-600">{app.description}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-600">
                {p.bullets.map((b) => (
                  <Check key={b}>{b}</Check>
                ))}
              </ul>
              <Link
                href={signedIn ? p.signedInHref : "/login"}
                className="mt-5 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                {signedIn ? `Open ${app.name} →` : `Sign in to try ${app.name} →`}
              </Link>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
