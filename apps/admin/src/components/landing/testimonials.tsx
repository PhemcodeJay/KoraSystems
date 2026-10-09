import { Section, SectionHeading } from "./ui";

/**
 * Testimonials band.
 *
 * Three short quotes from the three sides of the market. Illustrative copy for
 * now — swap for real, attributed quotes (with permission) before launch.
 */

type Testimonial = { quote: string; name: string; role: string; initials: string };

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I stopped guessing what to order. The forecast tells me when I'll run out, and the loan covers the gap.",
    name: "Grace Wanjiru",
    role: "Mama Mboga, Nairobi",
    initials: "GW",
  },
  {
    quote:
      "Orders come through clear and paid. No more chasing shops by phone at the end of the month.",
    name: "David Ochieng",
    role: "Distributor, Kisumu",
    initials: "DO",
  },
  {
    quote:
      "I split my groceries into parts and earn points every time I shop. Paying is one tap on M-Pesa.",
    name: "Aisha Mohammed",
    role: "Shopper, Mombasa",
    initials: "AM",
  },
];

export function Testimonials() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Loved across the market"
        title="Trusted by the people who use it every day."
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
          >
            <div aria-hidden className="text-accent-500">
              {"★★★★★"}
            </div>
            <blockquote className="mt-3 flex-1 text-sm text-ink-700">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800"
              >
                {t.initials}
              </span>
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">{t.name}</span>
                <span className="block text-ink-500">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
