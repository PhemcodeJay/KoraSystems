"use client";

import { useEffect, useState } from "react";
import { apiFetch, readError } from "@/lib/client";
import { Badge, Card, Empty, Table, Td, Th } from "@/components/ui";

type Member = {
  id: string; email: string; role: string; isActive: boolean;
  joinedAt: string; user?: { fullName: string } | null;
};

/**
 * Team seats: invite by email, change role via re-invite, remove seats.
 * The seat cap comes from the tenant tier — hitting it returns a 402 naming
 * the upgrade, surfaced inline rather than as a dead button.
 */
export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [seatsLimit, setSeatsLimit] = useState(3);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CASHIER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () =>
    fetch("/api/team", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.data) return;
        setMembers(d.data.members ?? []);
        setSeatsUsed(d.data.seatsUsed ?? 0);
        setSeatsLimit(d.data.seatsLimit ?? 3);
      })
      .catch(() => {});

  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await apiFetch("/api/team", { method: "POST", body: { email, role } });
      if (!res.ok) {
        setError(await readError(res, "Could not invite that email."));
        return;
      }
      setEmail("");
      setNotice(`Invited ${email.trim()}. They join the till once they sign in.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite that email.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this seat? They lose till access immediately.")) return;
    setError("");
    try {
      const res = await apiFetch(`/api/team?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await readError(res, "Could not remove that seat."));
        return;
      }
      await load();
    } catch {
      setError("Could not remove that seat.");
    }
  }

  const full = seatsLimit >= 0 && seatsUsed >= seatsLimit;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Team</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {seatsLimit < 0 ? `${seatsUsed} seats (unlimited)` : `${seatsUsed} of ${seatsLimit} seats used`}
        </p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      <Card title="Invite staff" hint={full ? "Seat limit reached — upgrade for more" : "They join once they sign in with this email"}>
        <form onSubmit={invite} className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
            placeholder="staff@example.co.ke"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="CASHIER">Cashier</option>
            <option value="MANAGER">Manager</option>
            <option value="OWNER">Owner</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Inviting…" : "Invite"}
          </button>
        </form>
      </Card>
      <Card title="Seats">
        {members.filter((m) => m.isActive).length === 0 ? (
          <Empty message="No seats yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr><Th>Member</Th><Th>Role</Th><Th className="text-right">Actions</Th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {members.filter((m) => m.isActive).map((m) => (
                <tr key={m.id}>
                  <Td>
                    <span className="font-medium text-ink-900">{m.user?.fullName ?? m.email}</span>
                    <span className="block text-xs text-ink-500">{m.email}</span>
                  </Td>
                  <Td><Badge>{m.role}</Badge></Td>
                  <Td>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        className="rounded border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100"
                      >
                        Remove
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
