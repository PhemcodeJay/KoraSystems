"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND, APPS, ROLE_LABELS, KoraLogo } from "@kora/brand";

type ShellUser = {
  id: string;
  email: string;
  fullName: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
};

/** The branded app each role will use once it ships. */
const APP_FOR_ROLE = {
  SME: APPS.sme,
  SUPPLIER: APPS.supplier,
  CUSTOMER: APPS.customer,
  ADMIN: APPS.admin,
} as const;

export function AccountShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const app = APP_FOR_ROLE[user.role];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/home" className="flex items-center gap-2.5">
            <KoraLogo size={32} />
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold text-ink-900">{app.name}</span>
              <span className="text-[11px] text-ink-500">{BRAND.legalName}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 sm:inline-flex">
              Demo data
            </span>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight text-ink-800">
                {user.fullName}
              </p>
              <p className="text-[11px] leading-tight text-ink-500">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-xs text-ink-400 sm:px-6">
        {`© ${new Date().getFullYear()} ${BRAND.legalEntity} · ${BRAND.tagline}`}
      </footer>
    </div>
  );
}
