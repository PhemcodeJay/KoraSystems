import { Section, SectionHeading } from "./ui";

/**
 * FAQ band.
 *
 * Uses native `<details>` so the accordion works with no client JavaScript and
 * stays keyboard- and screen-reader accessible. Questions are the ones a Kenyan
 * SME actually asks — money, connectivity, M-Pesa and credit eligibility.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does it work without internet?",
    a: "Not yet. The current platform requires an internet connection; offline POS support is still planned.",
  },
  {
    q: "How does M-Pesa integration work?",
    a: "STK collection can be enabled with Daraja credentials. C2B callback events are captured for reconciliation; loan disbursement remains simulated until a licensed partner is configured.",
  },
  {
    q: "How is my credit score calculated?",
    a: "The explainable score uses recent sales, repayment, savings, stock, supplier and business-history signals. It supports human review; it does not automatically approve a loan or guarantee eligibility.",
  },
  {
    q: "What does it cost?",
    a: "Start free on SalesPilot. Growth adds SwiftPOS from KES 2,500/month, and Enterprise adds Neobank from KES 7,500/month. Every paid plan starts with a 90-day free trial.",
  },
  {
    q: "Is my data safe?",
    a: "The platform applies signed sessions, role-based authorization and tenant scoping to business records. Review the service and database providers' security terms for infrastructure-level protections.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. KoraSystems is built mobile-first and runs on any phone, tablet or till — there is nothing to install beyond a browser.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered."
        sub="Everything people ask before they switch to KoraSystems."
      />
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-sm [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-ink-900">
              {f.q}
              <span
                aria-hidden
                className="text-ink-400 transition-transform group-open:rotate-45"
              >
                ＋
              </span>
            </summary>
            <p className="mt-3 text-sm text-ink-600">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
