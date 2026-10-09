"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, readError } from "@/lib/client";
import { Card } from "@/components/ui";

const FIELD =
  "mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

/**
 * Change your own password.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * An ADMIN password reset sets `mustChangePassword`, and the `(app)` layout
 * refuses to render anything else until it is cleared. That enforcement needed
 * somewhere to send the user, and there was nowhere: `/account` was not even in
 * the navigation. So the flag was written, read by nothing, and the reset
 * silently became permanent — the exact outcome it was added to prevent.
 *
 * The current password is required. A signed-in session is not sufficient
 * authority to rotate a credential, or anyone at an unlocked machine could lock
 * the owner out by setting a password only they knew.
 */
export function PasswordForm({ forced }: { forced?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Caught here as well as server-side so the user is not made to wait for a
    // round trip to be told two fields they just typed do not match.
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      if (!res.ok) {
        setError(await readError(res, "Could not change your password."));
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      // Re-renders the `(app)` layout, which is what lifts the forced redirect.
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card title="Password" hint="Signed in as you">
        <p className="text-sm text-ink-600">
          Your password has been changed. Any other device still signed in with
          the old one keeps working until its session expires.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Password"
      hint={
        forced
          ? "An administrator reset your password — choose your own to continue"
          : "At least 10 characters"
      }
    >
      {forced && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Set a password only you know before carrying on. Until you do, the
          rest of the platform is unavailable.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="pw-current" className="text-xs font-medium text-ink-600">
            Current password
          </label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="pw-new" className="text-xs font-medium text-ink-600">
            New password
          </label>
          <input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="pw-confirm" className="text-xs font-medium text-ink-600">
            Confirm new password
          </label>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={FIELD}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}