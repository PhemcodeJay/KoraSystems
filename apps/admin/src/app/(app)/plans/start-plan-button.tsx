"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, readError } from "@/lib/client";

/**
 * Self-serve "start trial" button for the plans page.
 *
 * Posts to `/api/billing/checkout`, which starts a time-boxed trial for the
 * caller's tenant (Growth adds SwiftPOS; a paid tier still needs M-Pesa). This
 * replaces the old `mailto:` "Request" link — the landing page sells a trial you
 * can start yourself, so the button has to actually start it, not open an email.
 *
 * Kept as its own client component so the plans page stays a Server Component:
 * only this slice ships interactivity and re-fetches.
 */
export function StartPlanButton({
  tier,
  cycle = "MONTHLY",
  label,
  className,
}: {
  tier: string;
  cycle?: "MONTHLY" | "YEARLY";
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        body: { tier, cycle },
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not start that plan.");
        return;
      }
      setDone(data?.message ?? "Your plan is active.");
      // Reflect the new tier/status on the page (usage, current-plan ring).
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start that plan.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p
        role="status"
        className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800"
      >
        {done}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          className ??
          "block w-full rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        }
      >
        {busy ? "Starting…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
