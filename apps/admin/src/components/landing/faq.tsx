import { Section, SectionHeading } from "./ui";

/**
 * FAQ band.
 *
 * Uses native `<details>` so the accordion works with no client JavaScript and
 * stays keyboard- and screen-reader accessible. Questions are the ones a Kenyan
 * SME actually asks — money, offline, M-Pesa and credit eligibility.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: "Does it work without internet?",
    a: "Yes. SwiftPOS keeps selling offline and stores sales on the device. The moment you reconnect, everything syncs automatically — no double entry.",
  },
  {
    q: "How does M-Pesa integration work?",
    a: "KoraSystems connects to Safaricom's Daraja API. Customers pay to your till, and you can pay suppliers, disburse loans or withdraw savings — all recorded on one ledger.",
  },
  {
    q: "How is my credit score calculated?",
    a: "From your real trading history — sales volume, consistency and stock movement. Strong, steady sales raise your score and the loan you qualify for. No collateral needed.",
  },
  {
    q: "What does it cost?",
    a: "Start free on SalesPilot. Growth adds SwiftPOS from KES 2,500/month, and Enterprise adds Neobank from KES 7,500/month. The first month is free on every paid plan.",
  },
  {
    q: "Is my data safe?",
    a: "Data is encrypted end to end, sessions are signed, and access is role-based on every screen. Your ledger is isolated to your business.",
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
