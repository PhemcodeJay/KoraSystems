import { Section, SectionHeading } from "./ui";

/**
 * "The problem" band.
 *
 * Names the three concrete pains KoraSystems removes, then the dark statement
 * band below carries the pivot. Kept short and specific — the goal is
 * recognition ("that's me"), not a lecture.
 */
export function Problem() {
  return (
    <Section>
      <SectionHeading
        eyebrow="The problem"
        title="Small business is still run on paper and guesswork."
        sub="Most shops juggle a notebook, a calculator and a spreadsheet. The result is the same everywhere."
      />
      <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
        <ProblemCard
          emoji="📒"
          title="No visibility"
          body="You can't tell your best product from your worst without counting stock by hand."
        />
        <ProblemCard
          emoji="🏦"
          title="No credit access"
          body="Banks can't see your real sales, so they can't lend — even when business is good."
        />
        <ProblemCard
          emoji="🔌"
          title="Too many tools"
          body="POS here, accounting there, payments somewhere else. Nothing talks to anything."
        />
      </ul>
    </Section>
  );
}

function ProblemCard({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <span aria-hidden className="text-2xl">{emoji}</span>
      <h3 className="mt-3 text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600">{body}</p>
    </li>
  );
}
