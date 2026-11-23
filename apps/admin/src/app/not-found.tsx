import type { Metadata } from "next";
import { BRAND, APPS } from "@kora/brand";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Page not found · ${APPS.admin.name}`,
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center">
      <div className="text-center">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2.5"
          aria-label={`${BRAND.displayName} home`}
        >
          <span className="text-base font-semibold text-ink-900">
            {BRAND.name}
          </span>
        </Link>
        <h1 className="text-3xl font-extrabold text-ink-900">404</h1>
        <p className="mt-4 text-lg text-ink-600">
          Page not found
        </p>
        <p className="mt-2 max-w-md mx-auto text-sm text-ink-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to homepage
        </Link>
      </div>
    </div>
  );
}
