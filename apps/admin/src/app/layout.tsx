import type { Metadata, Viewport } from "next";
import { BRAND, APPS, COLOR } from "@kora/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: APPS.admin.name,
    template: `%s · ${APPS.admin.name}`,
  },
  description: APPS.admin.description,
  applicationName: BRAND.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: APPS.admin.name,
    title: APPS.admin.name,
    description: APPS.admin.description,
    locale: BRAND.locale,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: APPS.admin.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: APPS.admin.name,
    description: APPS.admin.description,
    images: ["/opengraph-image"],
  },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: COLOR.primary[600],
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout is intentionally unauthenticated: it wraps both the sign-in
 * screen and the protected dashboard. The role gate lives in the (dash)
 * group layout, so /login can render without redirecting into a loop.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={BRAND.locale}>
      <body className="font-sans">{children}</body>
    </html>
  );
}

