"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fetchWrappedList } from "@/lib/client";
import { useCart } from "@/lib/cart";
import { fmtKES } from "@/lib/queries";
import { Card, Empty } from "@/components/ui";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  price: string | number;
  stockQuantity: number;
};

/**
 * The storefront, ported from the standalone customer app.
 *
 * /api/products answers with { data: [...] }, so the read goes through
 * fetchWrappedList — a bare-array read renders an empty grid with no error.
 * Add-to-cart writes to the shared tab-scoped cart, so an item added here is
 * waiting on /customer/cart.
 */
export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "price-asc" | "price-desc" | "stock">("name");
  const [added, setAdded] = useState<string | null>(null);
  const { add, count } = useCart();

  useEffect(() => {
    fetchWrappedList<Product>(api.products.path).then(setProducts);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = products.filter((p) => {
      if (!q) return true;
      return [p.name, p.sku, p.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const sorted = [...rows];
    if (sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "stock") sorted.sort((a, b) => b.stockQuantity - a.stockQuantity);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, query, sort]);

  function addToCart(p: Product) {
    add({ id: p.id, name: p.name, price: Number(p.price), stockQuantity: p.stockQuantity });
    setAdded(p.id);
    window.setTimeout(() => setAdded((cur) => (cur === p.id ? null : cur)), 1200);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Shop</h1>
          <p className="mt-0.5 text-sm text-ink-500">{visible.length} products</p>
        </div>
        <Link
          href="/customer/cart"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          {count} in cart
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or SKU…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort products"
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
        >
          <option value="name">Sort: name</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="stock">Most in stock</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <Card>
          <Empty
            message={
              products.length === 0
                ? "No products available yet."
                : "No products match that search."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => {
            const out = p.stockQuantity <= 0;
            return (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-ink-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-400">{p.sku}</p>
                <p className="mt-2 text-lg font-bold text-brand-700">{fmtKES(p.price)}</p>
                <p className="mb-3 mt-0.5 text-xs text-ink-400">
                  {out ? "Out of stock" : p.stockQuantity + " in stock"}
                </p>
                <button
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className="mt-auto rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {added === p.id ? "Added ✓" : out ? "Unavailable" : "Add to cart"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
