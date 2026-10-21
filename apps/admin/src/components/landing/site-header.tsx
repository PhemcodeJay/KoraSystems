import Link from "next/link";
import { KoraLogo, BRAND } from "@kora/brand";
import { Container } from "./ui";

/**
 * Sticky public header.
 *
 * Shows sign-in / create-account for visitors, or a shortcut back into the app
 * for a signed-in user. The nav anchors match the section ids on the landing
 * page so a single click scrolls to the matching band.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur">
      <Container className="flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.displayName} home`}>
          <KoraLogo size={36} rounded={9} />
          <span className="flex flex-col leading-none">
            <span className="text-base font-semibold text-ink-900">{BRAND.name}</span>
            <span className="text-[11px] text-ink-500">{BRAND.tagline}</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-6 text-sm font-medium text-ink-600 lg:flex">
          <a href="#products" className="hover:text-ink-900">Products</a>
          <a href="#how" className="hover:text-ink-900">How it works</a>
          <a href="#pricing" className="hover:text-ink-900">Pricing</a>
          <a href="#faq" className="hover:text-ink-900">FAQ</a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/home"
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
