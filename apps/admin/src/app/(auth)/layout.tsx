import Link from "next/link";
import type { Metadata } from "next";
import { KoraLogo } from "@kora/brand";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shared shell for the unauthenticated screens (/login, /register).
 *
 * Lifted from the old login-only layout so both forms render identically.
 * Deliberately outside the (app) gate: these pages must render with no
 * session, otherwise sign-in would redirect into a loop.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <KoraLogo size={40} rounded={10} />
          <span className="text-sm text-ink-500">Kora Systems</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
