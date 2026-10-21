/**
 * Offline sync engine for the POS.
 *
 * Tracks online/offline state, queues sales that could not be posted to the
 * server, and replays them when the connection returns. Also primes the local
 * product cache from the API so the till keeps working offline.
 */

import { api, apiFetch, ApiError } from "@/lib/client";
import {
  cacheProducts,
  getCachedProducts,
  enqueuePendingSale,
  getPendingSales,
  markPendingSaleSynced,
  removePendingSale,
  type PendingSale,
  type Product,
} from "@/lib/idb";

type SyncListeners = Set<(online: boolean) => void>;
const listeners: SyncListeners = new Set();

let online = typeof navigator !== "undefined" ? navigator.onLine : true;
let syncing = false;

export function isOnline(): boolean {
  return online;
}

export function isSyncing(): boolean {
  return syncing;
}

export function onSyncChange(cb: (online: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb(online);
}

/**
 * Bootstrap the offline layer: wire up window online/offline events, restore
 * the cached product catalogue, and replay any pending sales if we are online.
 */
export async function initOfflineSync(): Promise<void> {
  if (typeof window === "undefined") return;

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Prime the local cache from the server when online.
  if (online) await refreshCatalogue();
  // Replay any sales that were queued while previously offline.
  await replayPendingSales();
}

async function handleOnline() {
  online = true;
  syncing = false;
  emit();
  await refreshCatalogue();
  await replayPendingSales();
}

async function handleOffline() {
  online = false;
  emit();
}

/** Fetch the latest catalogue from the API and cache it locally. */
export async function refreshCatalogue(): Promise<Product[]> {
  try {
    const products = await apiFetch(api.products.path, {
      credentials: "same-origin",
    });
    const payload = await products.json();
    const list = Array.isArray(payload?.data) ? payload.data : payload;
    const normalised: Product[] = list.map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? null,
      price: Number(p.price ?? 0),
      stockQuantity: Number(p.stockQuantity ?? 0),
    }));
    await cacheProducts(normalised);
    return normalised;
  } catch {
    // Fall back to whatever is already cached.
    return getCachedProducts();
  }
}

/**
 * Record a sale. When online it is posted to the server immediately; when
 * offline it is queued in IndexedDB and replayed on reconnect.
 */
export async function recordSale(sale: {
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  paymentMethod: "CASH" | "MPESA_STK" | "WALLET" | "CARD";
  total: number;
}): Promise<{ synced: boolean; reference?: string; error?: string }> {
  const pending: Omit<PendingSale, "id"> = {
    createdAt: Date.now(),
    items: sale.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.price,
      lineTotal: i.lineTotal,
    })),
    paymentMethod: sale.paymentMethod,
    total: sale.total,
    status: "queued",
  };

  if (!online) {
    const id = await enqueuePendingSale(pending);
    return { synced: false, error: "Queued for sync when connection returns" };
  }

  try {
    const response = await apiFetch(api.sale.path, {
      method: "POST",
      body: { items: sale.items, paymentMethod: sale.paymentMethod },
    });
    const payload = await response.json();
    const reference = payload?.data?.reference ?? payload?.reference;
    return { synced: true, reference };
  } catch (error) {
    // Server unreachable or rejected — queue for later replay.
    const id = await enqueuePendingSale(pending);
    return {
      synced: false,
      reference: undefined,
      error: error instanceof ApiError ? error.message : "Queued for sync",
    };
  }
}

/**
 * Replay every queued sale to the server. Marks each as synced or failed.
 * Safe to call repeatedly; already-synced rows are skipped by status.
 */
export async function replayPendingSales(): Promise<void> {
  if (syncing || !online) return;
  syncing = true;

  try {
    const pending = await getPendingSales();
    const queued = pending.filter((p) => p.status === "queued" || p.status === "failed");

    for (const sale of queued) {
      try {
        await markPendingSaleSynced(sale.id, "replaying"); // optimistic
        const response = await apiFetch(api.sale.path, {
          method: "POST",
          body: {
            items: sale.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
            paymentMethod: sale.paymentMethod,
          },
        });
        const payload = await response.json();
        const reference = payload?.data?.reference ?? payload?.reference;
        await markPendingSaleSynced(sale.id, reference ?? "");
      } catch {
        // Leave as queued/failed; will be retried on the next online event.
      }
    }
  } finally {
    syncing = false;
  }
}

export type { Product, PendingSale };
export { getPendingSales };
