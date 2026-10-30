import { BRAND } from "@kora/brand";
import { SiteHeader } from "@/components/landing/site-header";
import { Container } from "@/components/landing/ui";
import Link from "next/link";

export const metadata = {
  title: `Demo — ${BRAND.displayName}`,
  description: "Book a 15-minute walkthrough of KoraSystems.",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <SiteHeader signedIn={false} />
      <main>
        <Container className="py-16">
          <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">
            See KoraSystems in 2 minutes
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-600">
            Watch the short demo, then book a 15-minute walkthrough where we set up
            your products for you.
          </p>

          <div className="mt-8 aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 shadow-sm">
            <div className="flex h-full items-center justify-center text-ink-500">
              Demo video coming soon
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="https://calendly.com/kora-systems/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Book a 15-minute walkthrough
            </a>
            <a
              href="https://wa.me/254700000000?text=Hi%20Kora%2C%20I%20want%20a%20demo"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-ink-300 bg-white px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Chat on WhatsApp
            </a>
            <Link
              href="/register"
              className="rounded-lg border border-ink-300 bg-white px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Start free trial
            </Link>
          </div>
        </Container>
      </main>
    </div>
  );
}