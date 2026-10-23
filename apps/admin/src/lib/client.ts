/**
 * Same-origin API client for the unified app.
 *
 * The platform is now ONE Next.js app serving the UI and the API from a single
 * origin, so every request below is a plain relative path. The previous design
 * had the SME, supplier and customer UIs as separate Vite bundles on their own
 * ports talking to this API cross-origin, which needed a CORS allowlist and
 * cookie-scoping that was never configured — those apps could not complete a
 * single authenticated call. One origin removes that whole class of problem.
 *
 * The two response shapes are still handled explicitly: list routes return a
 * bare array, while some return `{ data }`. Reading `.data` off everything (or
 * vice versa) silently produced empty tables, which is why it is centralised.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  /** True when the session is missing or expired and the user must sign in. */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

/**
 * Perform a request, throwing ApiError on a non-2xx status.
 *
 * The session is an httpOnly cookie, so credentials are sent explicitly. On a
 * same origin this is the modern default, but stating it keeps behaviour
 * identical if the app is ever mounted behind a proxy.
 */
export async function apiFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const { body, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...((headers as Record<string, string>) ?? {}),
  };

  let payload: string | undefined;
  if (body !== undefined) {
    if (typeof body === "string") {
      payload = body;
    } else {
      payload = JSON.stringify(body);
      requestHeaders["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(path, {
    ...rest,
    headers: requestHeaders,
    body: payload,
    credentials: "same-origin",
  });

  if (!response.ok) {
    let message = response.statusText || `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // Body was not JSON — keep the status-derived message.
    }
    throw new ApiError(message, response.status);
  }

  return response;
}

/** Fetch and decode JSON, unwrapping `{ data }` when the route wraps it. */
export async function apiJson<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const payload = (await response.json().catch(() => null)) as
    | T
    | { data?: T }
    | null;

  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    return (payload as { data: T }).data as T;
  }
  return payload as T;
}

/** Fetch a route that answers with a bare array. Never throws. */
export async function fetchList<T = any>(path: string): Promise<T[]> {
  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

/** Fetch a route that answers with `{ data: [...] }`. Never throws. */
export async function fetchWrappedList<T = any>(path: string): Promise<T[]> {
  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    return [];
  }
}

/** Fetch a route that answers with `{ data: <object|null> }`. Never throws. */
export async function fetchOne<T = any>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}

/** The error message from a failed response, or a generic fallback. */
export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string") return payload.error;
  } catch {
    // Body was not JSON.
  }
  return fallback;
}

/**
 * The single route map.
 *
 * Every entry here has a matching route file under src/app/api. Keeping paths
 * in one object is what stops a page hardcoding a URL that no longer exists —
 * which is exactly how the old facades drifted.
 */
export const api = {
  auth: {
    login: { method: "POST", path: "/api/auth/login" },
    logout: { method: "POST", path: "/api/auth/logout" },
    me: { method: "GET", path: "/api/auth/me" },
  },
  products: { method: "GET", path: "/api/products" },
  sales: { method: "GET", path: "/api/sales" },
  /**
   * Void a sale: reverses it and returns its stock. `DELETE` rather than a
   * separate `void` route because it maps one-to-one onto
   * `DELETE /api/sales/[id]`, which is where the reversal rules live.
   */
  saleVoid: { method: "DELETE", path: "/api/sales/:id" },
  /** Customer checkout. Customer-scoped: see /api/checkout. */
  sale: { method: "POST", path: "/api/checkout" },
  customers: { method: "GET", path: "/api/customers" },
  suppliers: { method: "GET", path: "/api/suppliers" },
  orders: { method: "GET", path: "/api/orders" },
  orderConfirm: { method: "POST", path: "/api/orders/:id/confirm" },
  orderShip: { method: "POST", path: "/api/orders/:id/ship" },
  orderDeliver: { method: "POST", path: "/api/orders/:id/deliver" },
  invoices: { method: "GET", path: "/api/invoices" },
  loans: { method: "GET", path: "/api/loans" },
  loanApply: { method: "POST", path: "/api/loans/apply" },
  loanApprove: { method: "POST", path: "/api/loans/:id/approve" },
  loanReject: { method: "POST", path: "/api/loans/:id/reject" },
  savings: { method: "GET", path: "/api/savings" },
  savingsDeposit: { method: "POST", path: "/api/savings/deposit" },
  savingsWithdraw: { method: "POST", path: "/api/savings/withdraw" },
  savingsTxns: { method: "GET", path: "/api/savings/transactions" },
  tills: { method: "GET", path: "/api/tills" },
  // No tillOpen/tillClose entries: `/api/till/open` and `/api/till/close`
  // were never implemented (only `GET /api/till` exists), so the catalog
  // must not advertise them — a truthless entry is a broken button waiting
  // to happen.
  inventoryAdjust: { method: "POST", path: "/api/inventory/adjust" },
  inventoryAdjustments: { method: "GET", path: "/api/inventory/adjustments" },
  inventoryLowStock: { method: "GET", path: "/api/inventory/low-stock" },
  receipts: { method: "GET", path: "/api/receipts" },
  wallet: { method: "GET", path: "/api/wallet" },
  walletTxns: { method: "GET", path: "/api/wallet/transactions" },
  ledgerTransactions: { method: "GET", path: "/api/ledger/transactions" },
  ledgerBalance: { method: "GET", path: "/api/ledger/balance" },
  salesPilotInsights: { method: "GET", path: "/api/sales-pilot/insights" },
  salesForecast: { method: "GET", path: "/api/sales-pilot/forecast" },
  onboardingStep: { method: "POST", path: "/api/onboarding/step" },
  onboardingComplete: { method: "POST", path: "/api/onboarding/complete" },
  onboardingStatus: { method: "GET", path: "/api/onboarding/status" },
  mpesaStk: { method: "POST", path: "/api/mpesa/stk" },
  mpesaC2bReconciliation: {
    method: "GET",
    path: "/api/mpesa/c2b/reconciliation",
  },
} as const;

/** Replace the `:id` placeholder in a route template. */
export function routePath(template: string, id: string): string {
  return template.replace(":id", encodeURIComponent(id));
}
