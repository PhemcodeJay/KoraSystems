import Link from "next/link";
import { Container } from "./ui";

/**
 * Closing CTA band.
 *
 * The last nudge before the footer. A full-bleed brand-green panel so it stands
 * apart from the neutral sections around it. Swaps to a "back to dashboard"
 * prompt for a signed-in user.
 */
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-ink-50">
      <Container className="py-16">
        <div className="rounded-2xl bg-brand-600 px-6 py-12 text-center shadow-lg sm:px-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to grow your business?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-50">
            Join thousands of African businesses running on KoraSystems. 90-day
            free trial, no card required.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={signedIn ? "/home" : "/register"}
              className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              {signedIn ? "Go to dashboard" : "Start free trial"}
            </Link>
            {!signedIn && (
              <Link
                href="/login"
                className="rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                See demo
              </Link>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
