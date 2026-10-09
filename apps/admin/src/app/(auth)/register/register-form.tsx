"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLE_LABELS } from "@kora/brand";

type Role = "SME" | "SUPPLIER" | "CUSTOMER";

const ROLES: Array<{ value: Role; title: string; hint: string }> = [
  { value: "SME", title: "Business", hint: ROLE_LABELS.SME },
  { value: "SUPPLIER", title: "Supplier", hint: ROLE_LABELS.SUPPLIER },
  { value: "CUSTOMER", title: "Shopper", hint: ROLE_LABELS.CUSTOMER },
];

const inputCls =
  "mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const labelCls = "text-xs font-medium text-ink-600";

export function RegisterForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>("SME");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          fullName,
          email,
          phone: phone || undefined,
          businessName: role === "SME" ? organisation : undefined,
          companyName: role === "SUPPLIER" ? organisation : undefined,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setBusy(false);
        return;
      }
      router.push(params.get("next") ?? (data.home as string) ?? "/home");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is it still running?");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-ink-900">Create your account</h1>
      <p className="mt-0.5 text-sm text-ink-500">
        One account for SwiftPOS, SalesPilot and Neobank.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <span className={labelCls}>I am joining as</span>
          <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                onClick={() => setRole(r.value)}
                className={`rounded-lg border px-2 py-2 text-center transition ${
                  role === r.value
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500/30"
                    : "border-ink-200 hover:bg-ink-50"
                }`}
              >
                <span className="block text-sm font-medium text-ink-900">{r.title}</span>
                <span className="block truncate text-[11px] text-ink-500">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="fullName" className={labelCls}>Full name</label>
          <input id="fullName" autoComplete="name" value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls} required minLength={2} />
        </div>

        {role !== "CUSTOMER" && (
          <div>
            <label htmlFor="organisation" className={labelCls}>
              {role === "SME" ? "Business name" : "Company name"}
            </label>
            <input id="organisation" autoComplete="organization" value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              className={inputCls} required minLength={2} />
          </div>
        )}

        <div>
          <label htmlFor="reg-email" className={labelCls}>Email</label>
          <input id="reg-email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls} required />
        </div>

        <div>
          <label htmlFor="phone" className={labelCls}>
            Phone <span className="text-ink-400">(optional)</span>
          </label>
          <input id="phone" type="tel" autoComplete="tel" placeholder="+2547…"
            value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label htmlFor="reg-password" className={labelCls}>Password</label>
          <input id="reg-password" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={inputCls} required minLength={8} />
          {demoMode && (
            <p className="mt-1 text-xs text-ink-500">
              Demo environment: every account signs in with the shared password{" "}
              <code className="rounded bg-ink-100 px-1">Demo@1234</code>.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </div>
  );
}
