"use client";

import { useState } from "react";
import Link from "next/link";
import { api, apiFetch, ApiError } from "@/lib/client";
import { useCart } from "@/lib/cart";
import { fmtKES } from "@/lib/queries";
import { Card, Empty } from "@/components/ui";

const METHODS = [
  { value: "MPESA_STK", label: "M-Pesa", cls: "bg-brand-600" },
  { value: "WALLET", label: "Wallet", cls: "bg-blue-700" },
  { value: "CASH", label: "Cash", cls: "bg-ink-700" },
];

/**
 * Cart and checkout.
 *
 * Reads the shared tab-scoped cart rather than owning local state — the old
 * page kept cart state to itself, so nothing else could add to it. Checkout
 * posts to /api/checkout, the CUSTOMER-scoped route: the previous target,
 * POST /api/sales, is guarded SME/ADMIN, so a signed-in shopper simply got a
 * 403 and could not buy anything. Prices are re-read server-side; the totals
 * here are display only.
 */
export default function CartPage() {
  const { lines, total, count, setQuantity, remove, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<string | null>(null);

  async function checkout(method: string) {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(api.sale.path, {
        method: "POST",
        body: {
          items: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
          paymentMethod: method,
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: { reference?: string } }
        | null;
      clear();
      setPlaced(payload?.data?.reference ?? "Order received");
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "We could not place that order. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Order placed">
          <p className="text-sm text-ink-600">
            Reference {placed}. Your order has been recorded and paid for.
          </p>
          <Link
            href="/customer/shop"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Continue shopping
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Your cart</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {count} {count === 1 ? "item" : "items"}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {lines.length === 0 ? (
        <Card>
          <Empty message="Your cart is empty." />
          <div className="mt-3 text-center">
            <Link
              href="/customer/shop"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Browse products
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Items">
            <ul className="divide-y divide-ink-100">
              {lines.map((l) => (
                <li
                  key={l.product.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="mr-auto">
                    <p className="text-sm font-medium text-ink-900">
                      {l.product.name}
                    </p>
                    <p className="text-xs text-ink-500">
                      {fmtKES(l.product.price)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setQuantity(l.product.id, l.quantity - 1)}
                      aria-label={"Decrease " + l.product.name}
                      className="h-7 w-7 rounded border border-ink-200 text-sm disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        (l.product.stockQuantity !== undefined &&
                          l.quantity >= l.product.stockQuantity)
                      }
                      onClick={() => setQuantity(l.product.id, l.quantity + 1)}
                      aria-label={"Increase " + l.product.name}
                      className="h-7 w-7 rounded border border-ink-200 text-sm disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <p className="w-24 text-right text-sm font-medium tabular-nums">
                    {fmtKES(l.quantity * Number(l.product.price))}
                  </p>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(l.product.id)}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Summary">
            <div className="flex justify-between text-sm">
              <span className="text-ink-500">Items</span>
              <span className="tabular-nums">{count}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums text-brand-700">{fmtKES(total)}</span>
            </div>

            <div className="mt-4 space-y-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => checkout(m.value)}
                  disabled={busy}
                  className={
                    m.cls +
                    " w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                  }
                >
                  {busy ? "Placing order…" : "Pay " + m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="mt-3 w-full text-xs text-ink-500 hover:text-ink-700 disabled:opacity-40"
            >
              Empty cart
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}
