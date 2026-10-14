import { Section, SectionHeading } from "./ui";

/**
 * "The problem" band.
 *
 * Names the concrete pains KoraSystems removes. Each card states the situation,
 * then a muted cost line says what that pain actually does to the business, so
 * the visitor recognises the *consequence*, not just the symptom — recognition
 * ("that's me"), not a lecture. The dark statement band below carries the pivot
 * to the solution, so the four gaps set up here are the four it answers there.
 */

type Pain = {
  emoji: string;
  title: string;
  body: string;
  cost: string;
};

const PAINS: Pain[] = [
  {
    emoji: "📒",
    title: "You're flying blind",
    body:
      "Sales, stock and profit live in a notebook, a calculator and your memory. You count stock by hand to find your best line — and you reorder on what sells, not on what's being ordered.",
    cost: "Margin leaks out the back door while you're still counting.",
  },
  {
    emoji: "🏦",
    title: "Good business, invisible to lenders",
    body:
      "The bank can't see your real sales, so it treats a thriving shop like a risk. Capital stays locked behind collateral you don't have.",
    cost: "You turn down growth — or borrow from a shylock — because your own record can't vouch for you.",
  },
  {
    emoji: "🔌",
    title: "Ten tools that don't talk",
    body:
      "A till here, a spreadsheet there, M-Pesa somewhere else, WhatsApp for suppliers. Nothing reconciles with anything.",
    cost: "Hours lost to double-entry, and no single number you'd trust with your money.",
  },
  {
    emoji: "💸",
    title: "Enterprise platforms built for someone else",
    body:
      "ATG, ATG Connect and Africa Trade Exchange are built for governments and enterprises — they solve trade finance, not the shop floor. Their tools assume a desk, a network and a finance team. They never run your till.",
    cost: "You pay for tools sized for a head office — or fall back to paper the moment data runs out.",
  },
];

export function Problem() {
  return (
    <Section>
      <SectionHeading
        eyebrow="The problem"
        title="The platforms built for enterprise don't serve the shop."
        sub="Africa's shops create real value every day — but the tools around them weren't built for them. ATG, ATG Connect and Africa Trade Exchange are built for governments and enterprises — they don't run a shop. Four gaps hold almost every owner back."
      />
      <ul className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2">
        {PAINS.map((p) => (
          <ProblemCard key={p.title} {...p} />
        ))}
      </ul>
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-ink-500">
        None of this is a failure of effort. It’s a missing operating system — and
        that’s exactly what we built.
      </p>
    </Section>
  );
}

function ProblemCard({ emoji, title, body, cost }: Pain) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <span aria-hidden className="text-2xl">
        {emoji}
      </span>
      <h3 className="mt-3 text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600">{body}</p>
      {/* The consequence, set off by a red rule so it reads as the cost of the
          gap, not another sentence. */}
      <p className="mt-3 border-l-2 border-danger/70 pl-3 text-sm text-ink-600">
        {cost}
      </p>
    </li>
  );
}
