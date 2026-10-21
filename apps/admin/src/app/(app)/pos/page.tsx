"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { fmtKES } from "@/lib/queries";
import { Card } from "@/components/ui";
import OfflineStatus from "@/components/offline-status";
import { Skeleton, SkeletonLine, LoadingSpinner } from "@/components/skeleton";
import { cachedFetch, clearCache } from "@/lib/ui";
import { api, apiFetch } from "@/lib/client";
import {
  initOfflineSync,
  isOnline,
  onSyncChange,
  recordSale,
  refreshCatalogue,
  type Product,
} from "@/lib/offline-sync";
import { getCart, saveCartItem, clearCart } from "@/lib/idb";

type CartItem = { product: Product; quantity: number };

type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  stockQuantity: number;
  reorderLevel: number | null;
};

type StockAdjustment = {
  id: string;
  productId: string;
  productName: string;
  adjustmentType: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
};

type SalesInsight = {
  date: string;
  revenue: number;
  sales: number;
};

const METHODS = [
  { value: "MPESA_STK", label: "M-Pesa", cls: "bg-brand-600" },
  { value: "WALLET", label: "Wallet", cls: "bg-blue-700" },
  { value: "CASH", label: "Cash", cls: "bg-ink-700" },
];

/**
 * Point of sale — offline-capable.
 *
 * The till works whether or not the device has a connection:
 *   - The product catalogue is cached in IndexedDB and loads instantly.
 *   - The cart is persisted locally, so a reload never loses the sale.
 *   - Checkout posts to the server when online, or queues the sale locally
 *     when offline. Queued sales replay automatically when the link returns.
 *
 * The server re-validates stock and price on POST /api/checkout — client-side
 * caps are a convenience, never the enforcement.
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
  const [online, setOnline] = useState(isOnline());

  // ── Inventory & analytics state ───────────────────────────────────────
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<
    StockAdjustment[]
  >([]);
  const [revenueTrend, setRevenueTrend] = useState<SalesInsight[]>([]);
  const [totalSalesToday, setTotalSalesToday] = useState(0);
  const [totalRevenueToday, setTotalRevenueToday] = useState(0);

  /** Bootstrap offline sync: load cached catalogue, restore cart, wire events. */
  useEffect(() => {
    let mounted = true;

    async function boot() {
      // 1. Show cached products immediately (works offline).
      const cached = await refreshCatalogue();
      if (mounted) setProducts(cached);

      // 2. Restore the persisted cart.
      const stored = await getCart();
      if (mounted) {
        setCart(
          stored.map((i) => ({
            product: {
              id: i.productId,
              name: i.productName,
              sku: i.sku,
              barcode: null,
              price: i.price,
              stockQuantity: 0,
            } as Product,
            quantity: i.quantity,
          }))
        );
      }

      // 3. Initialise online/offline listeners.
      initOfflineSync();

      // 4. Register service worker for offline asset caching.
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Non-fatal: app still works online without offline caching.
        });
      }
    }

    boot();

    const unsub = onSyncChange((o) => {
      if (mounted) setOnline(o);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  /** Re-sync the catalogue when we come back online. */
  useEffect(() => {
    if (!online) return;
    let mounted = true;
    refreshCatalogue().then((list) => {
      if (mounted) setProducts(list);
    });
    return () => {
      mounted = false;
    };
  }, [online]);

  /** Persist cart to IndexedDB whenever it changes. */
  useEffect(() => {
    let mounted = true;
    (async () => {
      await clearCart();
      for (const i of cart) {
        await saveCartItem({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          price: Number(i.product.price),
          quantity: i.quantity,
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [cart]);

  /** Load low-stock items and recent stock adjustments. */
  useEffect(() => {
    let mounted = true;
    async function loadInventory() {
      setInventoryLoading(true);
      try {
        const lowRes = await cachedFetch("/api/inventory/low-stock", {
          credentials: "same-origin",
        });
        if (mounted && lowRes.ok) {
          const data = await lowRes.json();
          setLowStockItems(Array.isArray(data) ? data : data.data ?? []);
        }
        const adjRes = await cachedFetch("/api/inventory/adjustments", {
          credentials: "same-origin",
        });
        if (mounted && adjRes.ok) {
          const data = await adjRes.json();
          const adjustments = Array.isArray(data) ? data : data.data ?? [];
          setStockAdjustments(adjustments.slice(0, 10));
        }
      } catch {
        // Non-fatal: inventory is advisory offline.
      } finally {
        if (mounted) setInventoryLoading(false);
      }
    }
    loadInventory();
    return () => {
      mounted = false;
    };
  }, []);

  /** Load today's sales totals and 7-day revenue trend. */
  useEffect(() => {
    let mounted = true;
    async function loadAnalytics() {
      setAnalyticsLoading(true);
      try {
        const res = await cachedFetch("/api/sales-pilot/insights", {
          credentials: "same-origin",
        });
        if (mounted && res.ok) {
          const data = await res.json();
          const insights = Array.isArray(data) ? data : data.data ?? [];
          const today = new Date().toISOString().slice(0, 10);
          const todayData = insights.find((d: SalesInsight) => d.date === today);
          if (mounted) {
            setTotalSalesToday(todayData?.sales ?? 0);
            setTotalRevenueToday(todayData?.revenue ?? 0);
            setRevenueTrend(insights.slice(-7));
          }
        }
      } catch {
        // Non-fatal: analytics is advisory offline.
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      mounted = false;
    };
  }, []);

  const addToCart = useCallback(
    (product: Product) => {
      setCart((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          if (existing.quantity >= product.stockQuantity) return prev;
          return prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          );
        }
        return product.stockQuantity > 0
          ? [...prev, { product, quantity: 1 }]
          : prev;
      });
    },
    [],
  );

  const setQuantity = useCallback((id: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product.id !== id)
        : prev.map((i) =>
            i.product.id === id
              ? { ...i, quantity: Math.min(quantity, i.product.stockQuantity) }
              : i,
          ),
    );
  }, []);

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

  async function handleStockAdjust(productId: string, quantity: number, reason: string) {
    setBusy(true);
    try {
      const res = await apiFetch(api.inventoryAdjust.path, {
        method: api.inventoryAdjust.method,
        body: { productId, quantity, reason },
        credentials: "same-origin",
      });
      if (res.ok) {
        clearCache("/api/inventory");
        setLowStockItems((prev) => prev.filter((i) => i.id !== productId));
        setError("");
      } else {
        setError("Stock adjustment failed.");
      }
    } catch {
      setError("Stock adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout(method: string) {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    setDone(null);
    try {
      const result = await recordSale({
        items: cart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          price: Number(i.product.price),
          quantity: i.quantity,
          lineTotal: Number(i.product.price) * i.quantity,
        })),
        paymentMethod: method as any,
        total,
      });

      if (result.synced) {
        setDone(result.reference ?? "Sale recorded");
        setCart([]);
        setError("");
        clearCache("/api/inventory");
        clearCache("/api/sales-pilot");
      } else {
        setError(result.error ?? "Sale queued — will sync when online.");
      }
    } catch {
      setError("Could not record the sale. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 gap-4">
      <OfflineStatus />

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card title="Total Sales Today">
          {analyticsLoading ? (
            <Skeleton className="h-12 w-24" />
          ) : (
            <p className="text-2xl font-bold text-ink-900">{totalSalesToday}</p>
          )}
        </Card>
        <Card title="Total Revenue Today">
          {analyticsLoading ? (
            <Skeleton className="h-12 w-24" />
          ) : (
            <p className="text-2xl font-bold text-ink-900">{fmtKES(totalRevenueToday)}</p>
          )}
        </Card>
        <Card title="Low Stock Items">
          {inventoryLoading ? (
            <Skeleton className="h-12 w-24" />
          ) : (
            <p className="text-2xl font-bold text-ink-900">{lowStockItems.length}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product catalogue */}
        <div className="lg:col-span-5">
          <Card title="Products" hint={`${products.length} item(s) in catalogue`}>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search product, SKU or barcode…"
                  className="flex-1 border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan barcode"
                  className="border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <button
                  onClick={scan}
                  disabled={busy || !barcode.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-brand-600 text-white disabled:opacity-50"
                >
                  Scan
                </button>
              </div>
              {error && (
                <p className="text-sm text-ink-500">{error}</p>
              )}
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-500">
                  No products found.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      disabled={busy || p.stockQuantity === 0}
                      className={`border rounded-lg p-3 text-left ${
                        p.stockQuantity === 0
                          ? "border-ink-100 bg-ink-50 text-ink-400"
                          : "border-brand-100 hover:bg-brand-50"
                      }`}
                    >
                      <p className="font-medium text-ink-900 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-ink-500 truncate">
                        {p.sku} {p.barcode ? `· ${p.barcode}` : ""}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-brand-700">
                        {fmtKES(p.price)}
                      </p>
                      <p className="text-xs mt-1">
                        {p.stockQuantity === 0
                          ? "Out of stock"
                          : `${p.stockQuantity} in stock`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Cart */}
        <div className="lg:col-span-2">
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
                  disabled={busy || cart.length === 0 || !online}
                  className={`w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50 ${m.cls} ${!online ? "opacity-50" : ""}`}
                >
                  {busy ? "Recording…" : `Take payment · ${m.label}`}
                </button>
              ))}
              {!online && (
                <button
                  onClick={() => checkout("CASH")}
                  disabled={busy || cart.length === 0}
                  className="mt-2 w-full rounded-lg py-2 text-sm font-medium border border-dashed border-amber-300 bg-amber-50 text-amber-900"
                >
                  Queue sale (offline)
                </button>
              )}
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

        {/* Inventory panel */}
        <div className="lg:col-span-3">
          <Card title="Low Stock &amp; Adjustments">
            {inventoryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : lowStockItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">No low-stock items.</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item: LowStockItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {item.sku} � {item.stockQuantity} left
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleStockAdjust(item.id, 10, "Restock to par level")
                      }
                      disabled={busy}
                      className="rounded px-2 py-1 text-xs border border-brand-600 text-brand-700 disabled:opacity-50 hover:bg-brand-50"
                    >
                      Restock
                    </button>
                  </div>
                ))}
                {stockAdjustments.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-ink-700 mb-1">Recent adjustments</p>
                    <ul className="space-y-1">
                      {stockAdjustments.slice(0, 5).map((adj: StockAdjustment) => (
                        <li key={adj.id} className="text-xs text-ink-500">
                          {adj.productName}:{" "}
                          {adj.quantity > 0 ? "+" : ""}{adj.quantity} {adj.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Analytics panel */}
        <div className="lg:col-span-2">
          <Card title="Revenue Trend (7d)">
            {analyticsLoading ? (
              <div className="h-32 flex items-center justify-center">
                <LoadingSpinner size={20} />
              </div>
            ) : (
              <div className="h-32 flex items-end gap-1">
                {revenueTrend.map((day: SalesInsight, i: number) => {
                  const max = Math.max(
                    ...revenueTrend.map((d: SalesInsight) => d.revenue),
                  );
                  const height = max > 0 ? (day.revenue / max) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-brand-100"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${fmtKES(day.revenue)}`}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {done && (
          <Card
            title="Sale recorded"
            hint={done}
            className="border-green-200 bg-green-50 text-ink-900 col-span-full"
          >
            <p className="text-sm mt-1">
              {online
                ? "The sale has been posted to the server."
                : "The sale is queued locally and will upload when the connection returns."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

