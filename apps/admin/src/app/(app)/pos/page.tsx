"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiFetch, ApiError, readError } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Card, Empty } from "@/components/ui";

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: string | number;
  stockQuantity: number;
};

type CartItem = { product: Product; quantity: number };

const METHODS = [
  { value: "MPESA_STK", label: "M-Pesa", cls: "bg-brand-600" },
  { value: "WALLET", label: "Wallet", cls: "bg-blue-700" },
  { value: "CASH", label: "Cash", cls: "bg-ink-700" },
];

/**
 * Point of sale.
 *
 * Ported from the standalone SME Vite app into the unified app, so it now runs
 * on the same origin as the API and shares the session cookie without CORS.
 *
 * Quantities are capped client-side for responsiveness, but the server
 * re-validates stock and price on POST /api/checkout — the cap here is a
 * convenience, never the enforcement.
 */
export default function PosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(api.products.path, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProducts(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setError("Could not load your catalogue."));
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return product.stockQuantity > 0 ? [...prev, { product, quantity: 1 }] : prev;
    });
  };

  const setQuantity = (id: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product.id !== id)
        : prev.map((i) =>
            i.product.id === id
              ? { ...i, quantity: Math.min(quantity, i.product.stockQuantity) }
              : i,
          ),
    );
  };

  const scan = () => {
    const term = barcode.trim();
    if (!term) return;
    const hit = products.find(
      (p) => p.barcode === term || p.sku.toLowerCase() === term.toLowerCase(),
    );
    if (hit) addToCart(hit);
    else setError(`No product matches "${term}".`);
    setBarcode("");
  };

  const total = cart.reduce(
    (sum, i) => sum + Number(i.product.price) * i.quantity,
    0,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(q),
    );
  }, [products, query]);

  async function checkout(method: string) {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(api.sale.path, {
        method: "POST",
        body: {
          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          paymentMethod: method,
        },
      });
      if (!response.ok) {
        setError(await readError(response, "The sale was not recorded."));
        return;
      }
      const payload = await response.json();
      setCart([]);
      setDone(payload?.data?.reference ?? "Sale recorded");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-brand-200 bg-brand-50/60 p-8 text-center">
        <h1 className="text-lg font-semibold text-brand-900">Sale recorded</h1>
        <p className="mt-1 text-sm text-brand-800">
          Reference <span className="font-mono">{done}</span>. The full amount is on
          the ledger.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={() => setDone(null)}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium"
          >
            New sale
          </button>
          <button
            onClick={() => router.push("/sme/sales")}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            View sales
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Point of sale</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Scan a barcode or pick from the grid. Every sale posts to the ledger.
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Barcode scanner">
            <div className="flex gap-2">
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && scan()}
                placeholder="Scan barcode or enter SKU…"
                className="w-full rounded-lg border border-ink-300 px-3 py-2 font-mono text-sm"
                aria-label="Barcode"
              />
              <button
                onClick={scan}
                className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium"
              >
                Add
              </button>
            </div>
          </Card>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, SKU or barcode…"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
            aria-label="Search products"
          />

          {filtered.length === 0 ? (
            <Empty message="No products match. Add stock from Inventory first." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stockQuantity === 0}
                  className="rounded-lg border border-ink-200 bg-white p-3 text-left transition hover:border-brand-300 disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.sku}</p>
                  <p className="mt-1 font-semibold text-brand-700">
                    {fmtKES(p.price)}
                  </p>
                  <p className="text-xs text-ink-400">
                    {p.stockQuantity === 0
                      ? "Out of stock"
                      : `${p.stockQuantity} in stock`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card title="Cart" hint={`${cart.length} line(s)`}>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">
                Nothing in the cart.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((i) => (
                  <li
                    key={i.product.id}
                    className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">
                        {i.product.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {fmtKES(i.product.price)} each
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => setQuantity(i.product.id, i.quantity - 1)}
                        disabled={busy}
                        className="h-7 w-7 rounded border border-ink-300 text-sm disabled:opacity-40"
                        aria-label={`Decrease ${i.product.name}`}
                      >
                        −
                      </button>
                      <span className="w-7 text-center tabular-nums">
                        {i.quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(i.product.id, i.quantity + 1)}
                        disabled={busy || i.quantity >= i.product.stockQuantity}
                        className="h-7 w-7 rounded border border-ink-300 text-sm disabled:opacity-40"
                        aria-label={`Increase ${i.product.name}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-ink-200 pt-3">
              <span className="text-sm text-ink-500">Total</span>
              <span className="text-lg font-semibold text-brand-700">
                {fmtKES(total)}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => checkout(m.value)}
                  disabled={busy || cart.length === 0}
                  className={`w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50 ${m.cls}`}
                >
                  {busy ? "Recording…" : `Take payment · ${m.label}`}
                </button>
              ))}
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                disabled={busy}
                className="mt-3 w-full text-xs text-ink-500 hover:text-ink-700 disabled:opacity-40"
              >
                Clear cart
              </button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}