import { Section, SectionHeading } from "./ui";

/**
 * Features band.
 *
 * The capability grid: the things that make KoraSystems more than a till. Each
 * tile pairs an icon with a short, concrete benefit. Icons are emoji so the
 * page ships no image assets and stays themeable through text colour.
 */

type Feature = { icon: string; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: "🤖",
    title: "AI Demand Forecasting",
    body: "See what will sell before you order. Know exactly when you'll run out — and what to restock.",
  },
  {
    icon: "📊",
    title: "Credit Score from Real Sales",
    body: "Your trading history becomes a score a lender can trust. No collateral required.",
  },
  {
    icon: "💰",
    title: "M-Pesa Native",
    body: "Collect and disburse straight from the Daraja API. Money in, money out, one ledger.",
  },
  {
    icon: "📴",
    title: "Works Offline",
    body: "Keep selling when the network drops. Everything syncs the moment you reconnect.",
  },
  {
    icon: "🔒",
    title: "Bank-Grade Security",
    body: "Encrypted end to end, signed sessions, and role-based access on every screen.",
  },
  {
    icon: "📱",
    title: "Mobile First",
    body: "Built on a phone, because that's where business happens. Fast on any device.",
  },
];

export function Features() {
  return (
    <Section tone="white" id="features">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need. Nothing you don't."
        sub="The tools that turn daily trading into growth — AI, payments and credit working off the same data."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article
            key={f.title}
            className="rounded-xl border border-ink-200 bg-ink-50/60 p-5 shadow-sm"
          >
            <span aria-hidden className="text-2xl">{f.icon}</span>
            <h3 className="mt-3 text-base font-semibold text-ink-900">{f.title}</h3>
            <p className="mt-1.5 text-sm text-ink-600">{f.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
