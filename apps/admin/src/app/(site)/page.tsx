import { getSessionUser } from "@kora/auth/guards";
import { BRAND, APPS } from "@kora/brand";
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
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: `${BRAND.displayName} — ${BRAND.tagline}`,
    description: BRAND.description,
    siteName: APPS.admin.name,
    locale: BRAND.locale,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${BRAND.displayName} — ${BRAND.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.displayName} — ${BRAND.tagline}`,
    description: BRAND.description,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
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

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://korasystems.onrender.com";

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: baseUrl,
    logo: `${baseUrl}/icon.svg`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+254700000000",
      contactType: "customer service",
      availableLanguage: ["en", "sw"],
      areaServed: "KE",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Nairobi",
      addressRegion: "Nairobi County",
      postalCode: "00100",
      addressCountry: "KE",
    },
    founder: {},
    foundingDate: {},
    brand: BRAND.name,
    slogan: BRAND.tagline,
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${baseUrl}/demo?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: BRAND.name,
    description: BRAND.description,
    image: `${baseUrl}/opengraph-image`,
    telephone: "+254700000000",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Nairobi",
      addressRegion: "Nairobi County",
      postalCode: "00100",
      addressCountry: "KE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -1.2921,
      longitude: 36.8219,
    },
    areaServed: "KE",
    currency: "KES",
    priceRange: "KES 1,500/month",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      opens: "08:00",
      closes: "17:00",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [],
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
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
