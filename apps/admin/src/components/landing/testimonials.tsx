import { Section, SectionHeading } from "./ui";

const TESTIMONIALS = [
  {
    quote:
      "I used to lose track of stock every week. Now I see every sale and every item left on my phone before I close the shop.",
    name: "Grace W.",
    role: "Retail shop owner, Nairobi",
  },
  {
    quote:
      "Customers pay through M-Pesa Till and the sale is recorded instantly. No more chasing receipts.",
    name: "James O.",
    role: "Hardware store, Kisumu",
  },
  {
    quote:
      "The credit review helped me get a loan without endless paperwork. Someone actually looked at my real sales.",
    name: "Amina K.",
    role: "SME retailer, Mombasa",
  },
];

export function Testimonials() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Trusted by Kenyan SMEs"
        title="Shop owners who switched to Kora"
        sub="Real feedback from pilot users."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
          >
            <blockquote className="text-sm text-ink-700">“{t.quote}”</blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold text-ink-900">{t.name}</span>
              <span className="block text-ink-500">{t.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
