import { BRAND, APPS } from "@kora/brand";
import { Demo } from "./demo-client";

export const metadata = {
  title: `Demo — ${BRAND.displayName}`,
  description: "Book a 15-minute walkthrough of KoraSystems",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    type: "website",
    url: "/demo",
    title: `Demo — ${BRAND.displayName}`,
    description: "Book a 15-minute walkthrough of KoraSystems",
    siteName: APPS.admin.name,
    locale: BRAND.locale,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `Demo — ${BRAND.displayName}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Demo — ${BRAND.displayName}`,
    description: "Book a 15-minute walkthrough of KoraSystems",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return <Demo />;
}