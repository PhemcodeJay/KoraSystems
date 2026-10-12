import { Container, Section, SectionHeading } from "./ui";

/**
 * "Today vs. KoraSystems" comparison band.
 *
 * The competitive frame. The Problem band names the gaps and the Statement band
 * says which product closes them; this band puts both sides in one place so a
 * visitor can scan the trade in a glance — what they run today on the left, what
 * the same thing becomes with KoraSystems on the right. Every claim here is one
 * the product actually delivers (one ledger, offline POS, M-Pesa on the receipt,
 * a credit score from real sales), so the comparison stays honest rather than
 * knocking strawmen.
 */

type Row = {
  capability: string;
  today: string;
  kora: string;
};

const ROWS: Row[] = [
  {
    capability: "See what actually sells",
    today: "Count stock by hand and trust memory at month-end.",
    kora: "Live sales, stock and profit — updated the moment you ring it up.",
  },
  {
    capability: "Know what to reorder",
    today: "Reorder on gut feel, then eat the spoilage when you guess wrong.",
    kora: "AI demand forecasting tells you what will sell before you order.",
  },
  {
    capability: "Get credit when you need it",
    today: "No record a bank trusts, so growth waits on collateral you don't have.",
    kora: "A credit score built from your real sales — no collateral required.",
  },
  {
    capability: "Keep one set of books",
    today: "A till, a spreadsheet, M-Pesa and WhatsApp that never reconcile.",
    kora: "One account and one balanced ledger across till, payments and lending.",
  },
  {
    capability: "Keep selling when the network drops",
    today: "Desktop software that stops the moment data runs out.",
    kora: "Offline-first POS on your phone that syncs when you reconnect.",
  },
  {
    capability: "Get paid cleanly",
    today: "Cash and manual M-Pesa checks you tally up at closing.",
    kora: "M-Pesa, wallet and cash on every receipt, in one ledger.",
  },
  {
    capability: "Pay for what you use",
    today: "Enterprise pricing sized for a head office you don't have.",
    kora: "Start free on SalesPilot; add the till and banking as you grow.",
  },
];

export function Comparison() {
  return (
    <Section tone="white">
      <Container>
        <SectionHeading
          eyebrow="The difference"
          title="What you run today vs. KoraSystems."
          sub="Same shop, same hustle — a different set of tools behind it. Here's what actually changes."
        />

        {/* Column labels. Hidden on the smallest screens where each row stacks
            the two cells under its capability heading instead. */}
        <div className="mx-auto mt-10 hidden max-w-4xl gap-4 px-1 sm:grid sm:grid-cols-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            What you run today
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            With KoraSystems
          </p>
        </div>

        <ul className="mx-auto mt-3 max-w-4xl space-y-4">
          {ROWS.map((r) => (
            <li
              key={r.capability}
              className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <h3 className="text-sm font-semibold text-ink-900 sm:text-base">
                {r.capability}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
                {/* Today — muted, with a red cross. */}
                <div className="flex gap-2 rounded-lg bg-ink-50 p-3">
                  <span aria-hidden className="mt-0.5 text-ink-400">
                    ✗
                  </span>
                  <p className="text-sm text-ink-500">{r.today}</p>
                </div>
                {/* Kora — brand-tinted, with a green tick. */}
                <div className="flex gap-2 rounded-lg bg-brand-50 p-3 ring-1 ring-inset ring-brand-600/10">
                  <span aria-hidden className="mt-0.5 font-semibold text-brand-600">
                    ✓
                  </span>
                  <p className="text-sm font-medium text-ink-800">{r.kora}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
