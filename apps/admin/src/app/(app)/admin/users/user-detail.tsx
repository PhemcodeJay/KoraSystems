"use client";

import { useState } from "react";
import { apiFetch, readError } from "@/lib/client";
import { Badge } from "@/components/ui";
import { TIERS, type Tier } from "@kora/auth/entitlements";
import { ROLE_LABELS } from "@kora/brand";

export type Role = "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";

export type AdminUser = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleAssignments: Array<{ role: Role; grantedVia: string | null }>;
  plan: { tier: Tier; status: string; cycle: string; amount: string | number } | null;
  sme: { id: string; businessName: string } | null;
  supplier: { id: string; companyName: string } | null;
  customer: { id: string; fullName: string } | null;
};

const humanise = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

/**
 * Account detail panel.
 *
 * Note what this component cannot do: it cannot display a password, because
 * `/api/users` and `/api/users/[id]` both use an explicit `select` that omits
 * `passwordHash`. An admin can *set* a new password here, but there is no code
 * path — client or server — that reads one back out.
 */
export function UserDetail({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function resetPassword() {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch(`/api/users/${user.id}/password`, {
        method: "POST",
        body: { password: newPassword },
      });
      if (!res.ok) {
        setResult(await readError(res, "Could not reset the password."));
        return;
      }
      setResult("Password reset. The user must change it at next sign-in.");
      setNewPassword("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<[string, string]> = [
    ["Phone", user.phone ?? "—"],
    ["Primary role", ROLE_LABELS[user.role]],
    [
      "Granted roles",
      user.roleAssignments.length
        ? user.roleAssignments
            .map((a) => `${ROLE_LABELS[a.role]} (via ${a.grantedVia ?? "admin"})`)
            .join(", ")
        : "None",
    ],
    [
      "Plan",
      user.plan
        ? `${TIERS[user.plan.tier].name} · ${humanise(user.plan.status)}`
        : "None",
    ],
    ["Products unlocked", user.plan ? TIERS[user.plan.tier].apps.join(", ") : "None"],
    ["Business", user.sme?.businessName ?? user.supplier?.companyName ?? "—"],
    ["Joined", new Date(user.createdAt).toLocaleDateString()],
    [
      "Last sign-in",
      user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never",
    ],
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">{user.fullName}</h2>
            <p className="text-sm text-ink-500">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {user.mustChangePassword && (
                <Badge className="bg-amber-50 text-amber-800 ring-amber-600/20">
                  Must change password
                </Badge>
              )}
              {!user.isActive && (
                <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20">
                  Suspended

                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-500 hover:bg-ink-100"
          >
            Close
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-500">{label}</dt>
              <dd className="text-right font-medium text-ink-800">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 rounded-lg border border-ink-200 p-4">
          <h3 className="text-sm font-semibold text-ink-900">Reset password</h3>
          <p className="mt-1 text-xs text-ink-500">
            Hashed with a per-password random salt via scrypt, then discarded.
            The API never returns the stored value.
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 10 characters)"
            className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={resetPassword}
            disabled={busy || newPassword.length < 10}
            className="mt-2 rounded-lg bg-ink-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Resetting..." : "Reset password"}
          </button>
          {result && (
            <p className="mt-2 text-xs text-ink-600" role="status">
              {result}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
