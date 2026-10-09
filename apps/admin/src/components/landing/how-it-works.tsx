import Link from "next/link";
import { Section, SectionHeading } from "./ui";

/**
 * How-it-works band.
 *
 * The three-step story: sign up, set up, grow. Each step gets a numbered badge
 * so the sequence reads at a glance, and the third step carries the primary CTA
 * so there is always a next action within reach.
 */
const STEPS = [
  {
    title: "Sign up",
    body: "Create your free account in under a minute. No card, no setup fee.",
  },
  {
    title: "Set up",
    body: "Add your products, set prices and turn on the till. Import or scan.",
  },
  {
    title: "Grow",
    body: "Watch sales, forecast demand and borrow against your record.",
  },
];

export function HowItWorks({ signedIn }: { signedIn: boolean }) {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title="Live in three steps."
        sub="From sign-up to your first AI-backed loan on the same day."
      />
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="relative rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
          >
            <span className="absolute -top-3 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
              {i + 1}
            </span>
            <h3 className="mt-3 text-base font-semibold text-ink-900">{s.title}</h3>
            <p className="mt-1.5 text-sm text-ink-600">{s.body}</p>
            {i === STEPS.length - 1 && (
              <Link
                href={signedIn ? "/home" : "/register"}
                className="mt-4 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                {signedIn ? "Go to dashboard →" : "Create your account →"}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
