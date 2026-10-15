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
    title: "Demand Forecasting",
    body: "Estimate product demand from completed sales and use stockout and reorder estimates to guide restocking.",
  },
  {
    icon: "📊",
    title: "Explainable Credit Scoring",
    body: "Sales and repayment signals produce a score with factor-by-factor explanations for human review.",
  },
  {
    icon: "💰",
    title: "M-Pesa STK Collections",
    body: "Request a customer payment through Daraja when credentials are configured; loan disbursement stays gated.",
  },
  {
    icon: "🧾",
    title: "Auditable Transactions",
    body: "Track sales, stock movements and payment states with role-scoped records.",
  },
  {
    icon: "🔒",
    title: "Role-Based Access",
    body: "Sessions and role checks protect business, supplier, customer and admin surfaces.",
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
