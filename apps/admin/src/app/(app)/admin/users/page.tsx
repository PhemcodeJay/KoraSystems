"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, readError } from "@/lib/client";
import { Badge, Card, Empty, Stat, Table, Td, Th } from "@/components/ui";
import { TIERS, TIER_ORDER, type AppKey, type Tier } from "@kora/auth/entitlements";
import { ROLE_LABELS } from "@kora/brand";
import { UserDetail, type AdminUser } from "./user-detail";

const APP_ICONS: Record<AppKey, string> = {
  salespilot: "📈",
  swiftpos: "▣",
  neobank: "🏦",
};

/**
 * Admin user console.
 *
 * Reads `/api/users`, which selects fields explicitly and never returns
 * `passwordHash`. This page is therefore structurally incapable of displaying
 * a credential: there is nothing to display. The subscription controls live on
 * the same list as the account list, because "who is on the platform" and "who
 * is on which plan" are the same question — splitting them across two screens
 * is how they drift.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("take", "200");

    setLoading(true);
    try {
      const res = await apiFetch(`/api/users?${params.toString()}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setMessage("Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, statusFilter]);

  useEffect(() => {
    // Debounced so typing does not fire a request per keystroke.
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  /** Change a tier. Granted roles follow from it automatically. */
  async function changeTier(user: AdminUser, tier: Tier) {
    setBusyId(user.id);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/users/${user.id}/subscription`, {
        method: "PATCH",
        body: { tier, reason: "Changed from user console" },
      });
      if (!res.ok) {
        setMessage(await readError(res, "Could not change the plan."));
        return;
      }
      await load();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  /** Activate or suspend an account. */
  async function toggleActive(user: AdminUser) {
    setBusyId(user.id);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        body: { isActive: !user.isActive },
      });
      if (!res.ok) {
        setMessage(await readError(res, "Could not update the account."));
        return;
      }
      await load();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  const stats = useMemo(() => {
    const byTier: Record<string, number> = {};
    let active = 0;
    let multiRole = 0;
    for (const u of users) {
      const key = u.plan?.tier ?? "NONE";
      byTier[key] = (byTier[key] ?? 0) + 1;
      if (u.isActive) active++;
      // Primary role plus at least one granted role.
      if (u.roleAssignments.length > 0) multiRole++;
    }
    return { byTier, active, multiRole };
  }, [users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Users</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {total} account{total === 1 ? "" : "s"} · passwords are stored as
          salted hashes and are never displayed
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={String(total)} />
        <Stat label="Active" value={String(stats.active)} tone="brand" />
        <Stat
          label="Multi-role"
          value={String(stats.multiRole)}
          hint="Primary role plus subscription-granted roles"
        />
        <Stat
          label="Without a plan"
          value={String(stats.byTier.NONE ?? 0)}
          tone="warning"
          hint="No products unlocked until a tier is set"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone or business…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by primary role"
        >
          <option value="">All roles</option>
          {(["SME", "SUPPLIER", "CUSTOMER", "ADMIN"] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by account status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Suspended</option>
        </select>
      </div>

      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      )}

      <Card>
        {loading ? (
          <Empty message="Loading users…" />
        ) : users.length === 0 ? (
          <Empty message="No users match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>User</Th>
                <Th>Roles</Th>
                <Th>Plan</Th>
                <Th>Products</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  busy={busyId === u.id}
                  onSelect={() => setSelected(u)}
                  onChangeTier={(t) => changeTier(u, t)}
                  onToggleActive={() => toggleActive(u)}
                />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {selected && (
        <UserDetail
          user={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  );
/** One account row. Split out to keep the list component readable. */
function UserRow({
  user,
  busy,
  onSelect,
  onChangeTier,
  onToggleActive,
}: {
  user: AdminUser;
  busy: boolean;
  onSelect: () => void;
  onChangeTier: (tier: Tier) => void;
  onToggleActive: () => void;
}) {
  const tier = user.plan?.tier ?? null;
  const unlocked = tier ? TIERS[tier].apps : [];

  return (
    <tr className="hover:bg-ink-50">
      <Td>
        <button type="button" onClick={onSelect} className="text-left">
          <p className="font-medium text-ink-900">{user.fullName}</p>
          <p className="text-xs text-ink-500">{user.email}</p>
        </button>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          <Badge>{ROLE_LABELS[user.role]}</Badge>
          {user.roleAssignments.map((a) => (
            <Badge
              key={a.role}
              className="bg-brand-50 text-brand-800 ring-brand-500/30"
              title={`Granted by ${a.grantedVia ?? "admin"}`}
            >
              +{ROLE_LABELS[a.role]}
            </Badge>
          ))}
        </div>
      </Td>
      <Td>
        {tier ? (
          <select
            value={tier}
            disabled={busy}
            onChange={(e) => onChangeTier(e.target.value as Tier)}
            className="rounded-lg border border-ink-200 px-2 py-1 text-xs"
            aria-label={`Plan for ${user.email}`}
          >
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {TIERS[t].name} · KES {TIERS[t].price.toLocaleString()}
              </option>
            ))}
          </select>
        ) : (
          <Badge className="bg-amber-50 text-amber-800 ring-amber-600/20">
            No plan
          </Badge>
        )}
      </Td>
      <Td>
        <div className="flex gap-1 text-sm">
          {unlocked.length === 0 ? (
            <span className="text-ink-400">—</span>
          ) : (
            unlocked.map((a) => (
              <span key={a} title={a}>
                {APP_ICONS[a]}
              </span>
            ))
          )}
        </div>
      </Td>
      <Td>
        <Badge
          className={
            user.isActive
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-slate-100 text-slate-600 ring-slate-500/20"
          }
        >
          {user.isActive ? "Active" : "Suspended"}
        </Badge>
      </Td>
      <Td className="text-xs text-ink-500">
        {user.lastLoginAt
          ? new Date(user.lastLoginAt).toLocaleDateString()
          : "Never"}
      </Td>
      <Td className="text-right">
        <button
          type="button"
          disabled={busy}
          onClick={onToggleActive}
          className="text-xs font-medium text-ink-600 hover:text-ink-900 disabled:opacity-50"
        >
          {user.isActive ? "Suspend" : "Reactivate"}
        </button>
      </Td>
    </tr>
  );
}

}
