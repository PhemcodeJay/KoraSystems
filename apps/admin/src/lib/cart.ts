"use client";

/**
 * Shared shopping cart for the customer storefront.
 *
 * The standalone customer app mounted a React context in its root; the unified
 * app has no single client root above /customer/*, so this is a small
 * subscription store instead — the same single source of truth, usable from
 * both /customer/shop and /customer/cart, without threading a provider through
 * a server layout.
 *
 * State is persisted to sessionStorage (tab-scoped, like the app it replaces)
 * so a refresh does not silently empty the cart. getServerSnapshot is a
 * constant, so the server render and the first hydration render agree; the
 * stored cart is swapped in immediately afterwards.
 */
import { useSyncExternalStore } from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number;
  stockQuantity?: number;
};

export type CartLine = { product: CartProduct; quantity: number };

const STORAGE_KEY = "kora.cart.v1";
const EMPTY: CartLine[] = [];

let lines: CartLine[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

/** Read the stored cart once per page load. Never throws. */
function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) lines = parsed as CartLine[];
  } catch {
    // Private mode or corrupt data — start empty rather than crash.
  }
}

function commit(next: CartLine[]) {
  lines = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode — the cart still works for this page load.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CartLine[] {
  hydrate();
  return lines;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

export function add(product: CartProduct, quantity = 1) {
  hydrate();
  const cap = product.stockQuantity ?? Number.POSITIVE_INFINITY;
  const existing = lines.find((l) => l.product.id === product.id);
  if (existing) {
    const nextQty = Math.min(existing.quantity + quantity, cap);
    commit(
      lines.map((l) =>
        l.product.id === product.id ? { ...l, quantity: nextQty } : l,
      ),
    );
    return;
  }
  commit([...lines, { product, quantity: Math.min(quantity, cap) }]);
}

export function setQuantity(productId: string, quantity: number) {
  hydrate();
  if (quantity <= 0) {
    remove(productId);
    return;
  }
  commit(
    lines.map((l) => {
      if (l.product.id !== productId) return l;
      const cap = l.product.stockQuantity ?? Number.POSITIVE_INFINITY;
      return { ...l, quantity: Math.min(quantity, cap) };
    }),
  );
}

export function remove(productId: string) {
  hydrate();
  commit(lines.filter((l) => l.product.id !== productId));
}

export function clear() {
  commit(EMPTY);
}

/** The cart plus its derived totals — the API both customer pages share. */
export function useCart() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = current.reduce((sum, l) => sum + l.quantity, 0);
  const total = current.reduce(
    (sum, l) => sum + l.quantity * Number(l.product.price),
    0,
  );
  return { lines: current, count, total, add, setQuantity, remove, clear };
}