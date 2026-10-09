import Link from "next/link";
import { KoraLogo, BRAND, APPS, legalLine } from "@kora/brand";
import { Container } from "./ui";

/**
 * Public marketing footer.
 *
 * Links to the three products and the account routes that exist in the app.
 * Company and legal links are inert placeholders (`#`) for now — the routes do
 * not exist yet — but they are grouped so wiring them later is a one-line edit
 * each rather than a redesign.
 */

const PRODUCT_LINKS = [
  { label: APPS.swiftpos.name, href: "/register" },
  { label: APPS.salespilot.name, href: "/register" },
  { label: APPS.neobank.name, href: "/register" },
];

const COMPANY_LINKS = [
  { label: "About", href: "#" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Contact", href: "#" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Security", href: "#" },
];

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "#" },
  { label: "Twitter / X", href: "#" },
  { label: "GitHub", href: "#" },
  { label: "Instagram", href: "#" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 bg-white">
      <Container className="py-12">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <KoraLogo size={36} rounded={9} />
              <span className="text-base font-semibold text-ink-900">{BRAND.name}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-500">{BRAND.tagline}</p>
          </div>

          <FooterColumn title="Products" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-200 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{legalLine()}</p>
          <p>
            Built in {BRAND.country}. For Africa. · {BRAND.supportEmail}
          </p>
          <ul className="flex gap-4">
            {SOCIAL_LINKS.map((s) => (
              <li key={s.label}>
                <a href={s.href} className="hover:text-ink-600">{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-ink-500">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="hover:text-ink-800">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
