import { Section, SectionHeading } from "./ui";

const USE_CASES = [
  {
    title: "For SME retailers",
    body: "Record sales, manage stock, and review demand estimates from recent trading history.",
  },
  {
    title: "For suppliers",
    body: "Follow orders and invoices in a shared workflow with the businesses you serve.",
  },
  {
    title: "For shoppers",
    body: "Browse participating SME catalogues and submit a cart from the customer storefront.",
  },
];

export function Testimonials() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Designed for commerce"
        title="One platform for the people behind each transaction."
        sub="These are product workflows, not customer testimonials."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {USE_CASES.map((item) => (
          <figure
            key={item.title}
            className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-base font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-2 text-sm text-ink-600">{item.body}</p>
          </figure>
        ))}
      </div>
    </Section>
  );
}
