import Link from "next/link";
import { Section, SectionHeading } from "./ui";

/**
 * Who-it-is-for band.
 *
 * The four roles on one platform: SME, supplier, shopper and the platform team.
 * This mirrors the role-based routing in the app — one account, four views — so
 * a visitor can see which of the four describes them before signing up.
 */

type Audience = { icon: string; title: string; body: string; cta: string };

const AUDIENCES: Audience[] = [
  {
    icon: "🏪",
    title: "Business owners (SME)",
    body: "Record sales, track stock, review demand estimates and build a business history for lender review.",
    cta: "Open a business account",
  },
  {
    icon: "🚚",
    title: "Suppliers",
    body: "Receive orders from shops, confirm and ship them, and get paid on one ledger.",
    cta: "Join as a supplier",
  },
  {
    icon: "🛍️",
    title: "Shoppers",
    body: "Buy from local businesses, spread payments in parts, and earn loyalty points.",
    cta: "Start shopping",
  },
  {
    icon: "🛡️",
    title: "Platform team",
    body: "Oversee SMEs, approve loans and monitor every transaction across the network.",
    cta: "See the admin panel",
  },
];

export function WhoFor({ signedIn }: { signedIn: boolean }) {
  return (
    <Section id="who">
      <SectionHeading
        eyebrow="Who it is for"
        title="One account. Four views."
        sub="The same platform serves every side of the market — pick the one that describes you."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a) => (
          <article
            key={a.title}
            className="flex flex-col rounded-xl border border-ink-200 bg-white p-5 shadow-sm"
          >
            <span aria-hidden className="text-2xl">{a.icon}</span>
            <h3 className="mt-3 text-base font-semibold text-ink-900">{a.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-ink-600">{a.body}</p>
            <Link
              href={signedIn ? "/home" : "/register"}
              className="mt-4 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              {signedIn ? "Go to dashboard →" : `${a.cta} →`}
            </Link>
          </article>
        ))}
      </div>
    </Section>
  );
}
