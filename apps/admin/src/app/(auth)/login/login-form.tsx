"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { DemoAccount } from "@kora/auth/authenticate";
import clsx from "clsx";
import { BRAND, APPS, ROLE_LABELS } from "@kora/brand";
import { Badge } from "@/components/ui";

export function LoginForm({
  accounts,
}: {
  accounts: DemoAccount[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@demo.kora.co.ke");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        setBusy(false);
        return;
      }
      const home = (data.home as string) || "/home";
      router.push(params.get("next") ?? home);
      router.refresh();
    } catch {
      setError("Could not reach the server. Is it still running?");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-ink-900">{APPS.admin.name}</h1>
      <p className="mt-0.5 text-sm text-ink-500">{APPS.admin.description}</p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-ink-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="text-xs font-medium text-ink-600">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-500">
        New here?{" "}
        <a href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Create an account
        </a>
      </p>

      {accounts.length > 0 && (
        <div className="mt-6 border-t border-ink-100 pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Demo accounts
            </p>
            <p className="text-xs text-ink-400">{accounts.length} total</p>
          </div>
          <p className="mt-1 text-xs text-ink-500">
            All accounts share the password{" "}
            <code className="rounded bg-ink-100 px-1">Demo@1234</code>. Pick one
            to fill the form.
          </p>

          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
            {accounts.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => setEmail(a.email)}
                  className={clsx(
                    "w-full rounded-lg px-2.5 py-2 text-left transition",
                    email === a.email
                      ? "bg-brand-50 ring-1 ring-inset ring-brand-200"
                      : "hover:bg-ink-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink-800">
                      {a.email}
                    </span>
                    <Badge>{ROLE_LABELS[a.role]}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {a.organisation ?? a.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {a.stats.map((s) => `${s.label} ${s.value}`).join(" · ")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-400">
            {BRAND.legalName} demo environment
          </p>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-ink-500">
        New to Kora?{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Create an account
        </Link>
      </p>
    </div>
  );
}
