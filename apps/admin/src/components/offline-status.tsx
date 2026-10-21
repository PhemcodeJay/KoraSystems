"use client";

import { useEffect, useState } from "react";
import { isOnline, isSyncing, onSyncChange, getPendingSales, type PendingSale } from "@/lib/offline-sync";
import { Card } from "./ui";

/**
 * Connection-status banner for the offline POS.
 *
 * Shows whether the till is online or offline, how many sales are waiting to
 * sync, and whether a sync is in progress. Placed at the top of the POS page
 * so the cashier always knows the connection state.
 */
export default function OfflineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(isSyncing());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const unsub = onSyncChange((o) => {
      setOnline(o);
      if (o) refreshPending();
    });
    refreshPending();
    return unsub;
  }, []);

  async function refreshPending() {
    try {
      const rows = await getPendingSales();
      setPending(rows.filter((r: PendingSale) => r.status === "queued" || r.status === "failed").length);
    } catch {
      setPending(0);
    }
  }

  useEffect(() => {
    const t = setInterval(() => setSyncing(isSyncing()), 1000);
    return () => clearInterval(t);
  }, []);

  if (online && pending === 0 && !syncing) return null;

  return (
    <Card
      title={online ? "Reconnecting…" : "You're offline"}
      hint={
        online
          ? `Syncing ${pending} sale(s)…`
          : `Till is offline. ${pending} sale(s) queued locally.`
      }
      className={
        "border-l-4 px-4 py-3 rounded-none " +
        (online
          ? "border-amber-500 bg-amber-50 text-amber-900"
          : "border-ink-500 bg-ink-50 text-ink-900")
      }
    >
      {!online && (
        <p className="text-xs mt-1 text-ink-600">
          Keep selling — sales are saved locally and will upload when the
          connection returns.
        </p>
      )}
      {online && syncing && (
        <p className="text-xs mt-1 text-amber-800">
          Uploading queued sales…
        </p>
      )}
    </Card>
  );
}
