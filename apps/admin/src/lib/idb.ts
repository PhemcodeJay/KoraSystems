/**
 * IndexedDB store for the offline-capable POS.
 *
 * The POS is local-first: the product catalogue and pending sales live in the
 * browser so a cashier can keep selling when the connection drops. When the
 * link returns, pending sales are replayed to the server.
 *
 * Schema (version 1):
 *   - products: cached product catalogue keyed by id
 *   - pendingSales: sales recorded while offline, awaiting sync
 *   - cart: the current in-progress cart (persisted across reloads)
 */
const DB_NAME = "kora-pos";
const DB_VERSION = 1;

type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  stockQuantity: number;
};

type PendingSale = {
  id: number;
  createdAt: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  paymentMethod: "CASH" | "MPESA_STK" | "WALLET" | "CARD";
  total: number;
  status: "queued" | "syncing" | "synced" | "failed";
  reference?: string;
  error?: string;
};

type CartItem = {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("products")) {
        const products = db.createObjectStore("products", { keyPath: "id" });
        products.createIndex("sku", "sku", { unique: true });
        products.createIndex("barcode", "barcode", { unique: false });
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains("cart")) {
        db.createObjectStore("cart", { keyPath: "productId" });
      }
    };
  });
  return dbPromise;
}

/** Run a readwrite transaction and resolve with the transaction. */
async function rw(storeName: string): Promise<IDBTransaction> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(tx);
  });
}

/** Run a readonly transaction and resolve with the transaction. */
async function ro(storeName: string): Promise<IDBTransaction> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(tx);
  });
}

async function put(storeName: string, value: unknown): Promise<void> {
  const tx = await rw(storeName);
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const tx = await ro(storeName);
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function del(storeName: string, key: IDBValidKey): Promise<void> {
  const tx = await rw(storeName);
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function clear(storeName: string): Promise<void> {
  const tx = await rw(storeName);
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function cacheProducts(products: Product[]): Promise<void> {
  await clear("products");
  for (const p of products) await put("products", p);
}

export async function getCachedProducts(): Promise<Product[]> {
  return getAll<Product>("products");
}

export async function enqueuePendingSale(sale: Omit<PendingSale, "id">): Promise<number> {
  const tx = await rw("pendingSales");
  return new Promise((resolve, reject) => {
    const request = tx.objectStore("pendingSales").add(sale);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return getAll<PendingSale>("pendingSales").then((rows) =>
    rows.sort((a, b) => a.createdAt - b.createdAt)
  );
}

export async function markPendingSaleSynced(id: number, reference: string): Promise<void> {
  const tx = await rw("pendingSales");
  const getReq = tx.objectStore("pendingSales").get(id);
  return new Promise((resolve, reject) => {
    getReq.onsuccess = () => {
      const row = getReq.result as PendingSale | undefined;
      if (row) {
        row.status = "synced";
        row.reference = reference;
        const putReq = tx.objectStore("pendingSales").put(row);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function removePendingSale(id: number): Promise<void> {
  await del("pendingSales", id);
}

export async function saveCartItem(item: CartItem): Promise<void> {
  await put("cart", item);
}

export async function removeCartItem(productId: string): Promise<void> {
  await del("cart", productId);
}

export async function clearCart(): Promise<void> {
  await clear("cart");
}

export async function getCart(): Promise<CartItem[]> {
  return getAll<CartItem>("cart");
}

export type { Product, PendingSale, CartItem };
