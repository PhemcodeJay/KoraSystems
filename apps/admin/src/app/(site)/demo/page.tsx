import { BRAND } from "@kora/brand";
import { SiteHeader } from "@/components/landing/site-header";
import { Container } from "@/components/landing/ui";
import Link from "next/link";
import { useAir } from "@/lib/air";

export const metadata = {
  title: `Demo — ${BRAND.displayName}`,
  description: "Book a 15-minute walkthrough of KoraSystems",
};

// Demo page now requires admin authentication
// Visiting this page without admin access will redirect to localhost:port/admin
export default function DemoPage() {
  const { user, isLoading, error } = useAir();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-50">
        <SiteHeader signedIn={false} />
        <main>
          <Container className="py-16">
            <div className="flex items-center justify-center h-64">
              <p className="text-ink-600">Loading...</p>
            </div>
          </Container>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink-50">
        <SiteHeader signedIn={false} />
        <main>
          <Container className="py-16">
            <div className="flex items-center justify-center h-64">
              <p className="text-ink-600">Error loading session</p>
            </div>
          </Container>
        </main>
      </div>
    );
  }

  if (!user) {
    // Redirect to admin page if not authenticated
    return (
      <div className="min-h-screen bg-ink-50">
        <SiteHeader signedIn={false} />
        <main>
          <Container className="py-16">
            <div className="text-center">
              <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">
                Admin Access Required
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-ink-600">
                Please visit <a href="/admin" className="text-brand-600 hover:text-brand-700">
                  localhost:port/admin
                </a> to access the admin dashboard.
              </p>
              <div className="mt-8">
                <a
                  href="/admin"
                  className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Go to Admin Dashboard
                </a>
              </div>
            </div>
          </Container>
        </main>
      </div>
    );
  }

  // User is authenticated, show the demo page
  return (
    <div className="min-h-screen bg-ink-50">
      <SiteHeader signedIn={true} />
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
              href="https://wa.me/254101674289?text=Hi%20Kora%2C%20I%20want%20a%20demo"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-ink-300 bg-white px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Chat on WhatsApp
            </a>
            {/* Removed the duplicate "Start free trial" / "Create an account" button */}
          </div>
        </Container>
      </main>
    </div>
  );
}