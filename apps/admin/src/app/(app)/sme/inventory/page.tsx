"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, apiJson, readError, fetchWrappedList } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Card, Empty, Table, Td, Th } from "@/components/ui";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  price: string | number;
  stockQuantity: number;
  lowStockThreshold: number;
};

type ProductForecast = Product & {
  forecast: {
    forecast7d: number;
    forecast30d: number;
    daysUntilStockout: number | null;
    recommendedOrder: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
  };
};

type Mode =
  | { kind: "new" }
  | { kind: "stock"; product: Product }
  | { kind: "edit"; product: Product }
  | null;

type ApiOptions = Parameters<typeof apiFetch>[1];

const FIELD =
  "mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const PRIMARY =
  "rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";
const QUIET =
  "rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100";
const ROWBTN =
  "rounded border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-100";

/**
 * Stock management.
 *
 * This replaced a bare numeric input on every row that expected the user to
 * know "5 adds, -3 removes", and an empty state telling them to "add stock
 * through the catalogue" — a page that does not exist, so a business with no
 * products had nowhere to create their first one.
 *
 * One panel now handles new product, stock in/out and edit details. Stock
 * itself only moves through `POST /api/inventory/adjust`, which writes the
 * StockAdjustment audit row and the new count in one transaction, so every
 * movement keeps a reason and an author. Editing stock from the product form is
 * deliberately not offered for that reason.
 */
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [qty, setQty] = useState("");
  const [dir, setDir] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", price: "", cat: "", stock: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [forecasts, setForecasts] = useState<ProductForecast[]>([]);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState("");

  const reload = () => fetchWrappedList<Product>(api.products.path).then(setProducts);
  useEffect(() => {
    reload().finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    apiJson<ProductForecast[]>(api.salesForecast.path)
      .then(setForecasts)
      .catch((e) => setForecastError(e instanceof Error ? e.message : "Could not load demand forecasts."))
      .finally(() => setForecastLoading(false));
  }, []);

  function open(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setQty("");
    setReason("");
    setDir("in");
    setForm(
      next?.kind === "edit"
        ? {
            name: next.product.name,
            sku: next.product.sku,
            price: String(next.product.price),
            cat: next.product.category ?? "",
            stock: String(next.product.stockQuantity),
          }
        : { name: "", sku: "", price: "", cat: "", stock: "" },
    );
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const cancel = () => setMode(null);
  const fail = (m: string) => setError(m);

  async function send(url: string, init: ApiOptions, ok: string, e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(url, init);
      if (!res.ok) {
        setError(await readError(res, "Could not save."));
        return;
      }
      await reload();
      setNotice(ok);
      setMode(null);
    } catch {
      fail("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const createProduct = (e: React.FormEvent) =>
    send(
      api.products.path,
      {
        method: "POST",
        body: {
          name: form.name,
          sku: form.sku,
          price: form.price,
          category: form.cat || undefined,
          stockQuantity: form.stock === "" ? 0 : Number(form.stock),
        },
      },
      `Added ${form.name}.`,
      e,
    );

  const editProduct = (e: React.FormEvent) => {
    if (mode?.kind !== "edit") return;
    return send(
      `/api/products/${mode.product.id}`,
      { method: "PATCH", body: { name: form.name, price: form.price, category: form.cat || null } },
      `Saved ${form.name}.`,
      e,
    );
  };

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (mode?.kind !== "stock") return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return fail("Enter a whole number greater than zero.");
    if (dir === "out" && n > mode.product.stockQuantity) {
      return fail(`Only ${mode.product.stockQuantity} in stock — cannot remove ${n}.`);
    }
    await send(
      api.inventoryAdjust.path,
      {
        method: "POST",
        body: {
          productId: mode.product.id,
          quantityDelta: dir === "in" ? n : -n,
          reason: reason.trim() || (dir === "in" ? "Stock received" : "Stock removed"),
        },
      },
      `${dir === "in" ? "Added" : "Removed"} ${n} of ${mode.product.name}.`,
      e,
    );
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? products.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(term))
    : products;
  const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  const value = products.reduce((s, p) => s + Number(p.price) * p.stockQuantity, 0);
return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Inventory</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {products.length} {products.length === 1 ? "product" : "products"} ·{" "}
            <span className={low.length ? "font-medium text-amber-700" : ""}>
              {low.length} at or below reorder level
            </span>{" "}
            · stock value {fmtKES(value)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            className="w-56 rounded-lg border border-ink-200 px-3 py-2 text-sm"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
          <button type="button" className={PRIMARY} onClick={() => open({ kind: "new" })}>
            New product
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <Card
        title="Demand forecast"
        hint="A 90-day, weekly-seasonal estimate from completed sales. Use it as a restocking aid, not a guarantee."
      >
        {forecastLoading ? (
          <p className="text-sm text-ink-500">Calculating forecasts…</p>
        ) : forecastError ? (
          <p role="alert" className="text-sm text-red-700">{forecastError}</p>
        ) : forecasts.length === 0 ? (
          <Empty message="Add active products to see their demand forecasts." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Next 7 days</Th>
                <Th className="text-right">Next 30 days</Th>
                <Th className="text-right">Stockout estimate</Th>
                <Th className="text-right">Suggested order</Th>
                <Th>Confidence</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {forecasts.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <span className="font-medium text-ink-900">{item.name}</span>
                    <span className="ml-2 text-xs text-ink-500">{item.sku}</span>
                  </Td>
                  <Td className="text-right">{Math.ceil(item.forecast.forecast7d)} units</Td>
                  <Td className="text-right">{Math.ceil(item.forecast.forecast30d)} units</Td>
                  <Td className="text-right">
                    {item.forecast.daysUntilStockout === null
                      ? "Not expected"
                      : `${item.forecast.daysUntilStockout} days`}
                  </Td>
                  <Td className="text-right">{item.forecast.recommendedOrder} units</Td>
                  <Td>{item.forecast.confidence.toLowerCase()}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {mode && (
        <Card
          title={
            mode.kind === "new"
              ? "New product"
              : mode.kind === "stock"
                ? `Add stock — ${mode.product.name}`
                : `Edit — ${mode.product.name}`
          }
          hint={
            mode.kind === "stock"
              ? `Currently ${mode.product.stockQuantity} in stock`
              : mode.kind === "edit"
                ? "Stock is changed with Add stock, not here"
                : "Opening stock is the starting count"
          }
        >
          {mode.kind === "stock" && (
            <form onSubmit={adjustStock} className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <span className="text-xs font-medium text-ink-600">Direction</span>
                  <div className="mt-1 flex rounded-lg border border-ink-200 p-0.5">
                    {(["in", "out"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={dir === d}
                        onClick={() => setDir(d)}
                        className={
                          "rounded-md px-3 py-1.5 text-sm font-medium " +
                          (dir === d
                            ? "bg-brand-600 text-white"
                            : "text-ink-600 hover:bg-ink-100")
                        }
                      >
                        {d === "in" ? "+ Add" : "− Remove"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-32">
                  <label htmlFor="qty" className="text-xs font-medium text-ink-600">
                    Quantity
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className={FIELD}
                    placeholder="0"
                  />
                </div>
                <div className="min-w-56 flex-1">
                  <label htmlFor="reason" className="text-xs font-medium text-ink-600">
                    Reason{" "}
                    <span className="text-ink-400">(optional, kept in the audit trail)</span>
                  </label>
                  <input
                    id="reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={FIELD}
                    placeholder={dir === "in" ? "Supplier delivery" : "Damaged / expired"}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={PRIMARY} disabled={busy}>
                  {busy ? "Saving…" : dir === "in" ? "Add stock" : "Remove stock"}
                </button>
                <button type="button" className={QUIET} onClick={cancel}>
                  Cancel
                </button>
              </div>
            </form>
          )}
{mode.kind === "new" && (
            <form onSubmit={createProduct} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="n-name" className="text-xs font-medium text-ink-600">Name</label>
                  <input id="n-name" required value={form.name} onChange={set("name")} className={FIELD} placeholder="Jubilee Mug 350ml" />
                </div>
                <div>
                  <label htmlFor="n-sku" className="text-xs font-medium text-ink-600">SKU</label>
                  <input id="n-sku" required value={form.sku} onChange={set("sku")} className={FIELD} placeholder="MUG-350" />
                </div>
                <div>
                  <label htmlFor="n-price" className="text-xs font-medium text-ink-600">Selling price (KES)</label>
                  <input id="n-price" required type="number" min={0} step="0.01" value={form.price} onChange={set("price")} className={FIELD} placeholder="450" />
                </div>
                <div>
                  <label htmlFor="n-stock" className="text-xs font-medium text-ink-600">Opening stock</label>
                  <input id="n-stock" type="number" min={0} step={1} value={form.stock} onChange={set("stock")} className={FIELD} placeholder="0" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="n-cat" className="text-xs font-medium text-ink-600">
                    Category <span className="text-ink-400">(optional)</span>
                  </label>
                  <input id="n-cat" value={form.cat} onChange={set("cat")} className={FIELD} placeholder="Drinkware" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={PRIMARY} disabled={busy}>
                  {busy ? "Adding…" : "Add product"}
                </button>
                <button type="button" className={QUIET} onClick={cancel}>Cancel</button>
              </div>
            </form>
          )}

          {mode.kind === "edit" && (
            <form onSubmit={editProduct} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="e-name" className="text-xs font-medium text-ink-600">Name</label>
                  <input id="e-name" required value={form.name} onChange={set("name")} className={FIELD} />
                </div>
                <div>
                  <label htmlFor="e-sku" className="text-xs font-medium text-ink-600">SKU</label>
                  <input id="e-sku" value={form.sku} disabled className={FIELD + " bg-ink-50 text-ink-500"} />
                </div>
                <div>
                  <label htmlFor="e-price" className="text-xs font-medium text-ink-600">Selling price (KES)</label>
                  <input id="e-price" required type="number" min={0} step="0.01" value={form.price} onChange={set("price")} className={FIELD} />
                </div>
                <div>
                  <label htmlFor="e-cat" className="text-xs font-medium text-ink-600">Category</label>
                  <input id="e-cat" value={form.cat} onChange={set("cat")} className={FIELD} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className={PRIMARY} disabled={busy}>
                  {busy ? "Saving…" : "Save details"}
                </button>
                <button type="button" className={QUIET} onClick={cancel}>Cancel</button>
              </div>
            </form>
          )}
        </Card>
      )}
<Card>
        {products.length === 0 && loaded ? (
          <Empty message="No products yet — use New product to add your first one." />
        ) : visible.length === 0 ? (
          <Empty message="No products match that search." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <Td>
                    <span className="font-medium text-ink-900">{p.name}</span>
                    {p.category && (
                      <span className="block text-xs text-ink-500">{p.category}</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{p.sku}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(p.price)}</Td>
                  <Td
                    className={
                      "text-right tabular-nums " +
                      (p.stockQuantity <= p.lowStockThreshold
                        ? "font-semibold text-amber-700"
                        : "")
                    }
                  >
                    {p.stockQuantity}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={ROWBTN}
                        onClick={() => open({ kind: "stock", product: p })}
                      >
                        Add stock
                      </button>
                      <button
                        type="button"
                        className={ROWBTN}
                        onClick={() => open({ kind: "edit", product: p })}
                      >
                        Edit
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