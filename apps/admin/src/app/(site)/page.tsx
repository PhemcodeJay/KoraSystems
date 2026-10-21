import { getSessionUser } from "@kora/auth/guards";
import { BRAND } from "@kora/brand";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { Statement } from "@/components/landing/statement";
import { Comparison } from "@/components/landing/comparison";
import { Stats } from "@/components/landing/stats";
import { Products } from "@/components/landing/products";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { WhoFor } from "@/components/landing/who-for";
import { Mpesa } from "@/components/landing/mpesa";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `${BRAND.displayName} — ${BRAND.tagline}`,
  description: BRAND.description,
};

/**
 * Public landing page — the marketing front door at `/`.
 *
 * The only unauthenticated page besides `/login` and `/register`. It is composed
 * from the section components under `@/components/landing`, each a small server
 * component, so the narrative (problem → products → pricing → FAQ → CTA) reads
 * top to bottom while each band stays independently editable.
 *
 * The session is read once here and passed down as `signedIn`, so every CTA can
 * point a returning visitor back into the app instead of asking them to create a
 * second account. This page never requires a session.
 */
export default async function LandingPage() {
  const user = await getSessionUser();
  const signedIn = !!user;

  return (
    <div className="min-h-screen bg-ink-50">
      <SiteHeader signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Problem />
        <Statement />
        <Comparison />
        <Stats />
        <Products signedIn={signedIn} />
        <Features />
        <HowItWorks signedIn={signedIn} />
        <WhoFor signedIn={signedIn} />
        <Mpesa />
        <Testimonials />
        <Pricing signedIn={signedIn} />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}
