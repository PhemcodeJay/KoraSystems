/**
 * Write the remaining pages of the unified app.
 *
 * The SME, supplier and customer UIs used to be separate Vite apps on their own
 * ports. They now live inside this one Next.js app, so the markup is generated
 * here rather than hand-copied — the result is reproducible, and a diff of this
 * file shows exactly what was ported.
 *
 * Run: node scripts/gen-unified-pages.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const APP = "apps/admin/src/app/(app)";

const write = (rel, body) => {
  const full = join(APP, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body.replace(/^\n/, ""), "utf8");
  console.log("wrote", rel);
};

/** Loads a route that answers with a bare array. */
const LIST = `const loadList = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : []))
    .then((d) => (Array.isArray(d) ? d : []))
    .catch(() => [] as any[]);`;

/** Loads a route that answers with `{ data: [...] }`. */
const WRAPPED = `const loadWrapped = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as any[]);`;

/**
 * A section layout guarding a role.
 *
 * The unified shell hides these links from other roles, but that is presentation
 * only. This guard is the authority, so reaching the URL directly is refused.
 */
const sectionLayout = (roles) => `import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";

/** ${roles.join(" / ")}-only section. */
export default async function SectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(${roles.map((r) => `"${r}"`).join(", ")});
  } catch {
    redirect("/");
  }
  return <>{children}</>;
}
`;

write("admin/layout.tsx", sectionLayout(["ADMIN"]));
write("supplier/layout.tsx", sectionLayout(["SUPPLIER", "SME", "ADMIN"]));

// ── SME: customers ────────────────────────────────────────────────────────
write(
  "sme/customers/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, Empty, Table, Td, Th } from "@/components/ui";

type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  town: string | null;
  county: string | null;
  loyaltyPoints: number;
  loyaltyTier: string | null;
  _count?: { sales: number };
};

${LIST}

/**
 * Customers who have bought from this business.
 *
 * The route answers with a bare array and is already tenant-scoped server-side
 * (an SME sees only customers with a sale of its own), so nothing is filtered
 * here — filtering again in the client would be redundant and could disagree
 * with the server's scope.
 */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadList(api.customers.path)
      .then((d) => setCustomers(d))
      .finally(() => setLoaded(true));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      \`\${c.fullName} \${c.email ?? ""} \${c.phone ?? ""}\`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Customers</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {customers.length} who have bought from you
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="w-64 rounded-lg border border-ink-300 px-3 py-2 text-sm"
          aria-label="Search customers"
        />
      </div>

      <Card>
        {visible.length === 0 ? (
          <Empty
            message={
              loaded
                ? "No customers yet — they appear after their first purchase."
                : "Loading…"
            }
          />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Customer</Th>
                <Th>Contact</Th>
                <Th>Location</Th>
                <Th className="text-right">Purchases</Th>
                <Th className="text-right">Points</Th>
                <Th>Tier</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium text-ink-900">{c.fullName}</Td>
                  <Td className="text-xs">
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div className="text-ink-500">{c.email}</div>}
                    {!c.phone && !c.email && "—"}
                  </Td>
                  <Td className="text-sm text-ink-600">
                    {[c.town, c.county].filter(Boolean).join(", ") || "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{c._count?.sales ?? 0}</Td>
                  <Td className="text-right tabular-nums">
                    {Number(c.loyaltyPoints ?? 0).toLocaleString()}
                  </Td>
                  <Td className="text-xs">{c.loyaltyTier ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
`,
);

// ── SME: suppliers + loans + savings ───────────────────────────────────────
write(
  "sme/suppliers/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Card, Empty, Table, Td, Th } from "@/components/ui";

type Supplier = {
  id: string;
  companyName: string;
  town: string | null;
  county: string | null;
  contactPhone: string | null;
  rating: string | number;
  _count?: { products: number; orders: number };
};

${LIST}

/**
 * Suppliers this business has a relationship with.
 *
 * The route scopes server-side to suppliers reachable through this SME's own
 * products or purchase orders, so an SME never sees every vendor on the
 * platform — only its own counterparties.
 */
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadList(api.suppliers.path)
      .then((d) => setSuppliers(d))
      .finally(() => setLoaded(true));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      \`\${s.companyName} \${s.town ?? ""}\`.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Suppliers</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {suppliers.length} you buy from or supply
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers…"
          className="w-64 rounded-lg border border-ink-300 px-3 py-2 text-sm"
          aria-label="Search suppliers"
        />
      </div>

      <Card>
        {visible.length === 0 ? (
          <Empty message={loaded ? "No suppliers yet." : "Loading…"} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Supplier</Th>
                <Th>Location</Th>
                <Th>Phone</Th>
                <Th className="text-right">Rating</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Orders</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-ink-900">{s.companyName}</Td>
                  <Td className="text-sm text-ink-600">
                    {[s.town, s.county].filter(Boolean).join(", ") || "—"}
                  </Td>
                  <Td className="text-xs">{s.contactPhone ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {Number(s.rating ?? 0).toFixed(1)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.products ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.orders ?? 0}
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
`,
);

write(
  "sme/loans/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, LOAN_STYLES, Table, Td, Th, humanise } from "@/components/ui";

type Loan = {
  id: string;
  loanNumber: string;
  principal: string | number;
  totalPayable: string | number;
  amountRepaid: string | number;
  status: string;
  createdAt: string;
};

${WRAPPED}

/**
 * Loans and credit applications.
 *
 * Applying records intent only. Disbursement stays behind the fail-closed gate
 * in @kora/disbursement, so nothing here moves money — an approved loan is
 * parked until a CBK-licensed partner is configured.
 */
export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    loadWrapped(api.loans.path).then((d) => setLoans(d as Loan[]));

  useEffect(() => {
    load();
  }, []);

  async function apply() {
    const principal = Number(amount);
    if (!Number.isFinite(principal) || principal <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(api.loanApply.path, {
        method: "POST",
        body: { principal, purpose },
      });
      if (!response.ok) {
        setError(await readError(response, "Could not submit the application."));
        return;
      }
      setAmount("");
      setPurpose("");
      await load();
    } catch {
      setError("Could not submit the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Loans</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Apply for working capital. Disbursement waits for a licensed partner.
        </p>
      </div>

      <Card title="Apply for a loan">
        {error && (
          <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="Amount (KES)"
            className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
            aria-label="Loan amount"
          />
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose"
            className="min-w-48 flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm"
            aria-label="Loan purpose"
          />
          <button
            onClick={apply}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </Card>

      <Card title="Your loans">
        {loans.length === 0 ? (
          <Empty message="No loan applications yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Loan</Th>
                <Th>Status</Th>
                <Th className="text-right">Principal</Th>
                <Th className="text-right">Repaid</Th>
                <Th className="text-right">Payable</Th>
                <Th>Applied</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loans.map((l) => (
                <tr key={l.id}>
                  <Td className="font-medium text-ink-900">{l.loanNumber}</Td>
                  <Td>
                    <Badge className={LOAN_STYLES[l.status]}>{humanise(l.status)}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.principal)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.amountRepaid)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(l.totalPayable)}</Td>
                  <Td className="text-xs">{fmtDate(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
`,
);

write(
  "sme/savings/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, readError } from "@/lib/client";
import { fmtKES, fmtDateTime } from "@/lib/queries";
import { Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

type Savings = {
  id: string;
  accountNumber: string;
  balance: string | number;
  totalDeposits: string | number;
  totalWithdrawals: string | number;
};

type Txn = {
  id: string;
  type: string;
  amount: string | number;
  balanceAfter: string | number;
  narration: string;
  createdAt: string;
};

const loadOne = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.data ?? null)
    .catch(() => null);

const loadTxns = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as Txn[]);

/**
 * Savings.
 *
 * The route answers { data: <account|null> }. Storing the wrapper made balance
 * undefined and rendered "KES NaN", so the unwrap is explicit here.
 */
export default function SavingsPage() {
  const [account, setAccount] = useState<Savings | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [a, t] = await Promise.all([
      loadOne(api.savings.path),
      loadTxns(api.savingsTxns.path),
    ]);
    setAccount(a);
    setTxns(t);
  };

  useEffect(() => {
    load();
  }, []);

  async function move(kind: "deposit" | "withdraw") {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(
        kind === "deposit" ? api.savingsDeposit.path : api.savingsWithdraw.path,
        { method: "POST", body: { amount: value } },
      );
      if (!response.ok) {
        setError(await readError(response, "The savings account rejected that request."));
        return;
      }
      setAmount("");
      await load();
    } catch {
      setError("The savings account rejected that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink-900">Savings</h1>

      {account ? (
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Balance" value={fmtKES(account.balance)} tone="brand" />
          <Stat label="Deposits" value={fmtKES(account.totalDeposits)} />
          <Stat label="Withdrawals" value={fmtKES(account.totalWithdrawals)} />
          <Stat label="Account" value={account.accountNumber} />
        </div>
      ) : (
        <Card>
          <Empty message="This business has no savings account yet. Open one from Setup." />
        </Card>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {account && (
        <Card title="Deposit or withdraw">
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              placeholder="Amount"
              className="rounded-lg border border-ink-300 px-3 py-2 text-sm"
              aria-label="Amount"
            />
            <button
              onClick={() => move("deposit")}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Deposit
            </button>
            <button
              onClick={() => move("withdraw")}
              disabled={busy}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>
        </Card>
      )}

      <Card title="Movements">
        {txns.length === 0 ? (
          <Empty message="No movements yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Balance</Th>
                <Th>Narration</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txns.map((t) => (
                <tr key={t.id}>
                  <Td className="text-sm">{humanise(t.type)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(t.amount)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(t.balanceAfter)}</Td>
                  <Td className="text-xs text-ink-600">{t.narration}</Td>
                  <Td className="text-xs">{fmtDateTime(t.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
`,
);

// ── Supplier: orders + invoices ───────────────────────────────────────────
const ORDER_STYLES = `const ORDER_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-600/20",
  CONFIRMED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SHIPPED: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/20",
};`;

write(
  "supplier/orders/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, routePath, readError } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Table, Td, Th, humanise } from "@/components/ui";

type Order = {
  id: string;
  orderNumber: string;
  totalAmount: string | number;
  status: string;
  placedAt: string;
  sme?: { businessName: string; town: string | null } | null;
};

${LIST}

${ORDER_STYLES}

/**
 * Purchase orders, with the confirm/ship/deliver lifecycle.
 *
 * A supplier sees only orders placed against it, and the route re-checks
 * ownership on every transition, so a status cannot be advanced on someone
 * else's order by guessing an id.
 */
export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => loadList(api.orders.path).then((d) => setOrders(d as Order[]));

  useEffect(() => {
    load();
  }, []);

  async function advance(order: Order) {
    const template =
      order.status === "PENDING"
        ? api.orderConfirm.path
        : order.status === "CONFIRMED"
          ? api.orderShip.path
          : order.status === "SHIPPED"
            ? api.orderDeliver.path
            : null;
    if (!template) return;

    setBusy(order.id);
    setError("");
    try {
      const response = await apiFetch(routePath(template, order.id), { method: "POST" });
      if (!response.ok) {
        setError(await readError(response, "Could not update that order."));
        return;
      }
      await load();
    } catch {
      setError("Could not update that order.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Orders</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Confirm, ship and deliver. {orders.length} order{orders.length === 1 ? "" : "s"}.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card>
        {orders.length === 0 ? (
          <Empty message="No orders yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Order</Th>
                <Th>Buyer</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>Placed</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-ink-900">{o.orderNumber}</Td>
                  <Td className="text-sm">
                    {o.sme?.businessName ?? "—"}
                    {o.sme?.town && (
                      <span className="block text-xs text-ink-500">{o.sme.town}</span>
                    )}
                  </Td>
                  <Td>
                    <Badge className={ORDER_STYLES[o.status]}>{humanise(o.status)}</Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(o.totalAmount)}
                  </Td>
                  <Td className="text-xs">{fmtDate(o.placedAt)}</Td>
                  <Td>
                    {o.status !== "DELIVERED" && o.status !== "CANCELLED" && (
                      <button
                        onClick={() => advance(o)}
                        disabled={busy === o.id}
                        className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {busy === o.id
                          ? "Saving…"
                          : o.status === "PENDING"
                            ? "Confirm"
                            : o.status === "CONFIRMED"
                              ? "Ship"
                              : "Deliver"}
                      </button>
                    )}
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
`,
);

write(
  "supplier/invoices/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtKES, fmtDate } from "@/lib/queries";
import { Badge, Card, Empty, Table, Td, Th, humanise } from "@/components/ui";

type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: string | number;
  amountPaid: string | number;
  status: string;
  dueDate: string | null;
  sme?: { businessName: string } | null;
};

const INVOICE_STYLES: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  SENT: "bg-sky-50 text-sky-700 ring-sky-600/20",
  OVERDUE: "bg-red-50 text-red-700 ring-red-600/20",
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/**
 * Invoices raised against this supplier.
 *
 * The route scopes to the caller's own supplier id server-side, so this shows
 * only what that supplier is owed.
 */
export default function SupplierInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    fetch(api.invoices.path, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInvoices(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setInvoices([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Invoices</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}.
        </p>
      </div>

      <Card>
        {invoices.length === 0 ? (
          <Empty message="No invoices yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium text-ink-900">{i.invoiceNumber}</Td>
                  <Td className="text-sm">{i.sme?.businessName ?? "—"}</Td>
                  <Td>
                    <Badge className={INVOICE_STYLES[i.status] ?? undefined}>
                      {humanise(i.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{fmtKES(i.totalAmount)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(i.amountPaid)}</Td>
                  <Td className="text-xs">{fmtDate(i.dueDate)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
`,
);

// ── Payments: one page for every role that moves money ────────────────────
write(
  "payments/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtKES, fmtDateTime } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

type Txn = {
  id: string;
  reference: string;
  type: string;
  description: string | null;
  amount: string | number;
  postedAt: string;
  simulated: boolean;
};

type Balance = { accountCode: string; debit: number; credit: number; balance: number };

${LIST}

const loadBalances = (path: string) =>
  fetch(path, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (Array.isArray(d?.data) ? d.data : []))
    .catch(() => [] as Balance[]);

/**
 * Payments and the ledger.
 *
 * One page for every role that moves money, replacing the separate Neobank and
 * SwiftPOS dashboards. Amounts come from ledger postings rather than by summing
 * Sale/Loan/Savings rows, because those are already represented in the ledger
 * and summing both would double count.
 *
 * Postings flagged \`simulated\` recorded no real money movement. That is the
 * expected state while no licensed disbursement partner is configured.
 */
export default function PaymentsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      loadList(api.ledgerTransactions.path).then((d) => setTxns(d as Txn[])),
      loadBalances(api.ledgerBalance.path).then(setBalances),
    ]).finally(() => setLoading(false));
  }, []);

  const totals = balances.reduce(
    (acc, b) => ({
      debits: acc.debits + Number(b.debit ?? 0),
      credits: acc.credits + Number(b.credit ?? 0),
    }),
    { debits: 0, credits: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Payments</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          M-Pesa, wallet and ledger activity. Every posting balances.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Postings" value={String(txns.length)} />
        <Stat label="Total debits" value={fmtKES(totals.debits)} />
        <Stat label="Total credits" value={fmtKES(totals.credits)} tone="brand" />
      </div>

      <Card
        title="Account balances"
        hint="Read from ledger entries, not from summing domain tables"
      >
        {balances.length === 0 ? (
          <Empty message={loading ? "Loading…" : "No postings yet."} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Account</Th>
                <Th className="text-right">Debits</Th>
                <Th className="text-right">Credits</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {balances.map((b) => (
                <tr key={b.accountCode}>
                  <Td className="font-mono text-xs">{b.accountCode}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(b.debit)}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(b.credit)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(b.balance)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Recent postings">
        {txns.length === 0 ? (
          <Empty message={loading ? "Loading…" : "No postings yet."} />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Reference</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>When</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txns.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.reference}</Td>
                  <Td>
                    <Badge>{humanise(t.type)}</Badge>
                    {t.simulated && (
                      <span className="ml-1 text-xs text-ink-400">simulated</span>
                    )}
                  </Td>
                  <Td className="text-sm text-ink-600">{t.description ?? "—"}</Td>
                  <Td className="text-xs">{fmtDateTime(t.postedAt)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(t.amount)}
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
`,
);

write("customer/layout.tsx", sectionLayout(["CUSTOMER"]));

// ── Customer: storefront ─────────────────────────────────────────────────
write(
  "customer/shop/page.tsx",
  `"use client";

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
`,
);

// ── SME: sales history ───────────────────────────────────────────────────
write(
  "sme/sales/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { fmtDateTime, fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: { name: string } | null;
};

type Sale = {
  id: string;
  totalAmount: string | number;
  paymentMethod: string;
  paymentStatus: string;
  mpesaReceipt: string | null;
  soldAt: string;
  items?: SaleItem[];
};

${LIST}

/**
 * The business's own completed sales.
 *
 * /api/sales answers with a bare array and is already tenant-scoped
 * server-side, so nothing is filtered again here. Clicking a row expands its
 * line items.
 */
export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadList(api.sales.path).then((d) => setSales(d as Sale[]));
  }, []);

  const total = sales.reduce((s, x) => s + Number(x.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Sales</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {sales.length} {sales.length === 1 ? "sale" : "sales"} · {fmtKES(total)} total
        </p>
      </div>

      <Card title="Completed sales" hint="Click a row to see its items">
        {sales.length === 0 ? (
          <Empty message="No sales recorded yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Date</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Items</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sales.map((s) => {
                const open = expanded === s.id;
                const units = s.items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
                return (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    units={units}
                    open={open}
                    onToggle={() => setExpanded(open ? null : s.id)}
                  />
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {sales.length > 0 && (
        <p className="text-xs text-ink-400">Click a row to see its items.</p>
      )}
    </div>
  );
}

function SaleRow({
  sale,
  units,
  open,
  onToggle,
}: {
  sale: Sale;
  units: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-ink-50" onClick={onToggle}>
        <Td className="whitespace-nowrap text-xs">
          {fmtDateTime(sale.soldAt)}
        </Td>
        <Td className="text-xs">
          {humanise(sale.paymentMethod)}
          {sale.mpesaReceipt && (
            <span className="block font-mono text-[11px] text-ink-400">
              {sale.mpesaReceipt}
            </span>
          )}
        </Td>
        <Td>
          <Badge
            className={
              sale.paymentStatus === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                : "bg-amber-50 text-amber-800 ring-amber-600/20"
            }
          >
            {humanise(sale.paymentStatus)}
          </Badge>
        </Td>
        <Td className="text-right tabular-nums">{units}</Td>
        <Td className="text-right font-medium tabular-nums">
          {fmtKES(sale.totalAmount)}
        </Td>
      </tr>
      {open && sale.items && sale.items.length > 0 && (
        <tr className="bg-ink-50">
          <td colSpan={5} className="px-3 py-2.5">
            <ul className="space-y-1">
              {sale.items.map((i) => (
                <li key={i.id} className="flex justify-between text-xs">
                  <span>
                    {i.product?.name ?? "Product"} × {i.quantity}
                  </span>
                  <span className="tabular-nums">{fmtKES(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
`,
);

// ── SME: onboarding wizard ───────────────────────────────────────────────
write(
  "sme/onboarding/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, ApiError } from "@/lib/client";
import { Card } from "@/components/ui";

type Step = "business" | "products" | "payments";
type Status = { onboardingStep: string; businessName: string; mpesaTill: string | null };

const STEPS: Step[] = ["business", "products", "payments"];
const LABELS: Record<Step, string> = {
  business: "Business info",
  products: "First product",
  payments: "Payments",
};

const input =
  "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none";

/**
 * Three-step SME setup, ported from the standalone app.
 *
 * The wizard used to POST across origins to handlers that did not exist, so
 * no step ever advanced and there was no way to tell — the failure was logged
 * and swallowed. Every step now reports its errors in the UI, and the page
 * resumes from the server's recorded step after a refresh rather than
 * restarting at business information.
 */
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("business");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [mpesaTill, setMpesaTill] = useState("");

  useEffect(() => {
    fetch(api.onboardingStatus.path, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s = d?.data;
        if (!s) return;
        setStatus(s);
        setBusinessName(s.businessName ?? "");
        setMpesaTill(s.mpesaTill ?? "");
        if (s.onboardingStep === "COMPLETE") setDone(true);
        else if (s.onboardingStep === "PAYMENTS") setStep("payments");
        else if (s.onboardingStep === "PRODUCTS") setStep("products");
      })
      .catch(() => {
        // Offline or signed out — the wizard still works, errors surface on submit.
      });
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (step === "business") {
        await apiFetch(api.onboardingStep.path, {
          method: "POST",
          body: {
            step: "BUSINESS_INFO",
            data: {
              businessName,
              businessType,
              county,
              town,
              registrationNumber,
              yearsInBusiness: yearsInBusiness
                ? parseInt(yearsInBusiness, 10)
                : undefined,
            },
          },
        });
        setStep("products");
      } else if (step === "products") {
        await apiFetch(api.products.path, {
          method: "POST",
          body: {
            name: productName,
            sku,
            price: parseFloat(price),
            stockQuantity: parseInt(stock, 10),
          },
        });
        setStep("payments");
      } else {
        await apiFetch(api.onboardingComplete.path, {
          method: "POST",
          body: { mpesaTill },
        });
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save that step.");
    } finally {
      setBusy(false);
    }
  }

  if (done || status?.onboardingStep === "COMPLETE") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Setup complete">
          <p className="text-sm text-ink-600">
            Your business profile is active. You can trade from the point of
            sale and adjust stock from Inventory whenever you are ready.
          </p>
        </Card>
      </div>
    );
  }

  const idx = STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Set up your business</h1>
        <p className="mt-0.5 text-sm text-ink-500">Step {idx + 1} of 3</p>
      </div>

      <div className="flex gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={
              "h-2 flex-1 rounded-full " +
              (i <= idx ? "bg-brand-600" : "bg-ink-200")
            }
          />
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <Card title={LABELS[step]}>
        <div className="space-y-4">
          {step === "business" && (
            <>
              <input
                className={input}
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <input
                className={input}
                placeholder="Business type (retail, services…)"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
              <input
                className={input}
                placeholder="Registration number (optional)"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className={input}
                  placeholder="County"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Town"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                />
              </div>
              <input
                className={input}
                type="number"
                min={0}
                placeholder="Years in business"
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(e.target.value)}
              />
            </>
          )}

          {step === "products" && (
            <>
              <input
                className={input}
                placeholder="Product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
              <input
                className={input}
                placeholder="SKU"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className={input}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price (KES)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="Stock quantity"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </>
          )}

          {step === "payments" && (
            <>
              <p className="text-sm text-ink-500">
                Link your M-Pesa till to receive payments. You can do this
                later — the wizard completes without it.
              </p>
              <input
                className={input}
                placeholder="M-Pesa till number (optional)"
                value={mpesaTill}
                onChange={(e) => setMpesaTill(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {idx > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              onClick={() => setStep(STEPS[idx - 1])}
              disabled={busy}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            onClick={submit}
            disabled={busy || (step === "business" && !businessName.trim())}
          >
            {busy
              ? "Saving…"
              : step === "payments"
                ? "Complete setup"
                : "Continue"}
          </button>
        </div>
      </Card>
    </div>
  );
}
`,
);

// ── Customer: cart and checkout ──────────────────────────────────────────
write(
  "customer/cart/page.tsx",
  `"use client";

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
`,
);

// ── SME: inventory ───────────────────────────────────────────────────────
write(
  "sme/inventory/page.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, ApiError, fetchWrappedList } from "@/lib/client";
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

/**
 * Stock levels for this business's catalogue, with inline adjustments.
 *
 * /api/products answers { data: [...] }, so the read goes through
 * fetchWrappedList — a bare-array read shows an empty table with no error.
 * Adjustments post to /api/inventory/adjust, which applies the delta to the
 * product in the same transaction as the audit row; the table is refetched
 * from the server afterwards rather than patched optimistically, so what is
 * shown is what was actually recorded.
 */
export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const reload = () =>
    fetchWrappedList<Product>(api.products.path).then(setProducts);

  useEffect(() => {
    reload().finally(() => setLoaded(true));
  }, []);

  async function adjust(p: Product) {
    const raw = edits[p.id];
    if (raw === undefined || raw.trim() === "") return;
    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0) {
      setError("Enter a non-zero adjustment, e.g. 5 to add or -3 to remove.");
      return;
    }
    setBusyId(p.id);
    setError("");
    try {
      await apiFetch(api.inventoryAdjust.path, {
        method: "POST",
        body: { productId: p.id, quantityDelta: delta },
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      await reload();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save the adjustment.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? products.filter((p) =>
        (p.name + " " + p.sku).toLowerCase().includes(term),
      )
    : products;

  const lowStock = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Inventory</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {products.length} {products.length === 1 ? "product" : "products"} ·{" "}
            <span className={lowStock.length ? "font-medium text-amber-700" : ""}>
              {lowStock.length} at or below reorder level
            </span>
          </p>
        </div>
        <input
          type="search"
          className="w-64 rounded-lg border border-ink-200 px-3 py-2 text-sm"
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search inventory"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <Card hint="Enter a positive number to add stock, a negative one to remove it.">
        {products.length === 0 && loaded ? (
          <Empty message="No products yet. Add stock through the catalogue." />
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
                <Th>Adjust</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((p) => {
                const low = p.stockQuantity <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <Td>
                      <span className="font-medium text-ink-900">{p.name}</span>
                      {p.category && (
                        <span className="block text-xs text-ink-500">
                          {p.category}
                        </span>
                      )}
                    </Td>
                    <Td className="font-mono text-xs">{p.sku}</Td>
                    <Td className="text-right tabular-nums">
                      {fmtKES(p.price)}
                    </Td>
                    <Td
                      className={
                        "text-right tabular-nums " +
                        (low ? "font-semibold text-amber-700" : "")
                      }
                    >
                      {p.stockQuantity}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-ink-200 px-2 py-1 text-sm"
                          placeholder="+ / −"
                          value={edits[p.id] ?? ""}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }))
                          }
                          aria-label={"Adjust stock for " + p.name}
                        />
                        <button
                          type="button"
                          className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                          onClick={() => adjust(p)}
                          disabled={
                            busyId === p.id || (edits[p.id] ?? "").trim() === ""
                          }
                        >
                          {busyId === p.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
`,
);

// ── Admin: console overview ──────────────────────────────────────────────
//
// The overview itself is the server-rendered AdminHome (already used for the
// "/" dispatcher); pointing /admin/overview at it keeps one console rather
// than maintaining a second client-side dashboard like the old (dash) group.
write(
  "admin/overview/page.tsx",
  `import { AdminHome } from "../../admin-home";

export const dynamic = "force-dynamic";

/**
 * The platform console.
 *
 * Reuses AdminHome rather than porting the old client dashboard: the stats
 * there are computed server-side from the same queries, and the action tiles
 * already link to the /admin/* pages below.
 */
export default function AdminOverviewPage() {
  return <AdminHome />;
}
`,
);

// ── Admin: ledger ────────────────────────────────────────────────────────
write(
  "admin/transactions/[reference]/page.tsx",
  `import { notFound } from "next/navigation";
import Link from "next/link";
import { getTransactionWithEntries, fmtKES, fmtDateTime } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * One posting and its ledger legs.
 *
 * The balance banner is computed from the entries below rather than trusting
 * a stored flag, so an unbalanced posting is visible here even if nothing
 * else checks it.
 */
export default async function TransactionDetail({
  params,
}: {
  params: { reference: string };
}) {
  const txn = await getTransactionWithEntries(params.reference);
  if (!txn) notFound();

  const dr = txn.entries
    .filter((e) => e.direction === "DEBIT")
    .reduce((s, e) => s + Number(e.amount), 0);
  const cr = txn.entries
    .filter((e) => e.direction === "CREDIT")
    .reduce((s, e) => s + Number(e.amount), 0);
  const balanced = Math.abs(dr - cr) < 0.01;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/transactions"
          className="text-sm text-brand-700 hover:underline"
        >
          ← Back to transactions
        </Link>
        <h1 className="mt-2 break-all font-mono text-lg font-semibold text-ink-900">
          {txn.reference}
        </h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {humanise(txn.type)} · {txn.accountCode} · {fmtDateTime(txn.postedAt)}
          {txn.smeOwner ? " · " + txn.smeOwner.businessName : ""}
        </p>
      </div>

      <div
        className={
          "rounded-xl border p-4 text-sm " +
          (balanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900")
        }
      >
        <p className="font-medium">
          {balanced ? "Balanced" : "Unbalanced"} — debits {fmtKES(dr)} vs credits{" "}
          {fmtKES(cr)}
        </p>
        {txn.simulated && (
          <p className="mt-1">
            This posting is flagged simulated. No real money moved.
          </p>
        )}
      </div>

      <Card title="Double-entry breakdown">
        {txn.entries.length === 0 ? (
          <Empty message="This posting has no ledger legs." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Account</Th>
                <Th>Direction</Th>
                <Th className="text-right">Amount</Th>
                <Th>Narration</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txn.entries.map((e) => (
                <tr key={e.id}>
                  <Td className="font-mono text-xs">{e.accountCode}</Td>
                  <Td>
                    <Badge
                      className={
                        e.direction === "DEBIT"
                          ? "bg-ink-900 text-white ring-ink-900/20"
                          : "bg-ink-100 text-ink-700 ring-ink-300/40"
                      }
                    >
                      {e.direction}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(e.amount)}
                  </Td>
                  <Td className="text-sm text-ink-600">{e.narration ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ink-200 bg-ink-50 font-medium">
              <tr>
                <Td>Total</Td>
                <Td className="text-xs text-ink-500">Dr / Cr</Td>
                <Td className="text-right tabular-nums">
                  {fmtKES(dr)} / {fmtKES(cr)}
                </Td>
                <Td>
                  <span className="sr-only">No narration</span>
                </Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      {txn.description && (
        <Card title="Description">
          <p className="text-sm text-ink-700">{txn.description}</p>
        </Card>
      )}
    </div>
  );
}
`,
);

// ── Admin: businesses ────────────────────────────────────────────────────
write(
  "admin/smes/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchList } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Stat, Table, Td, Th } from "@/components/ui";

type Sme = {
  id: string;
  businessName: string;
  businessType: string | null;
  county: string | null;
  town: string | null;
  onboardingStatus: string;
  subscriptionStatus: string;
  subscriptionAmount: string | number;
  user?: { email: string; fullName: string; isActive: boolean };
  _count?: { sales: number; products: number; loans: number };
};

/**
 * Every business on the platform.
 *
 * /api/smes answers with a bare array (ADMIN-only, platform-wide by nature),
 * so the read goes through fetchList — the old page read \`.data\` off it and
 * the table stayed empty with no error.
 */
export default function AdminSmesPage() {
  const [smes, setSmes] = useState<Sme[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList<Sme>("/api/smes")
      .then(setSmes)
      .finally(() => setLoading(false));
  }, []);

  const statuses = useMemo(
    () =>
      ["ALL", ...Array.from(new Set(smes.map((s) => s.onboardingStatus)))].sort(),
    [smes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return smes.filter((s) => {
      if (status !== "ALL" && s.onboardingStatus !== status) return false;
      if (!q) return true;
      return [s.businessName, s.county, s.businessType, s.user?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [smes, query, status]);

  const active = smes.filter((s) => s.subscriptionStatus === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Businesses</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {smes.length} on the platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Businesses" value={String(smes.length)} />
        <Stat label="Active subscriptions" value={String(active)} tone="brand" />
        <Stat
          label="Sales recorded"
          value={String(smes.reduce((n, s) => n + (s._count?.sales ?? 0), 0))}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, county or email…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by onboarding status"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <Empty message="Loading businesses…" />
        ) : filtered.length === 0 ? (
          <Empty message="No businesses match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Business</Th>
                <Th>Location</Th>
                <Th>Onboarding</Th>
                <Th>Subscription</Th>
                <Th className="text-right">Sales</Th>
                <Th className="text-right">Products</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50">
                  <Td>
                    <p className="font-medium text-ink-900">{s.businessName}</p>
                    <p className="text-xs text-ink-500">{s.user?.email}</p>
                  </Td>
                  <Td className="text-sm">
                    {s.county ?? "—"}
                    {s.town ? " · " + s.town : ""}
                  </Td>
                  <Td>
                    <Badge>{humanise(s.onboardingStatus)}</Badge>
                  </Td>
                  <Td>
                    <Badge
                      className={
                        s.subscriptionStatus === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-amber-50 text-amber-800 ring-amber-600/20"
                      }
                    >
                      {humanise(s.subscriptionStatus)}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.sales ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s._count?.products ?? 0}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtKES(s.subscriptionAmount)}
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
`,
);

// ── Admin: credit desk ───────────────────────────────────────────────────
write(
  "admin/loans/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import { api, apiFetch, ApiError, fetchWrappedList, routePath } from "@/lib/client";
import { fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, LOAN_STYLES, Stat, Table, Td, Th } from "@/components/ui";

type Loan = {
  id: string;
  loanNumber: string;
  principal: string | number;
  maxApprovedAmount: string | number | null;
  termMonths: number;
  purpose: string | null;
  status: string;
};

/**
 * The loan review queue.
 *
 * /api/loans answers { data: [...] }, so the read goes through
 * fetchWrappedList. Approve and reject hit the real /api/loans/:id routes
 * (they previously called endpoints that did not exist, so both buttons
 * silently did nothing), failures are shown in the page, and both buttons
 * disable while in flight so a double-click cannot submit twice.
 *
 * Approving records a decision only — disbursement stays behind the
 * fail-closed gate, so no money moves from this screen.
 */
export default function AdminLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("PENDING");

  useEffect(() => {
    fetchWrappedList<Loan>(api.loans.path)
      .then(setLoans)
      .finally(() => setLoading(false));
  }, []);

  async function decide(loanId: string, action: "approve" | "reject") {
    setBusyId(loanId);
    setError("");
    setNotice("");
    try {
      const template =
        action === "approve" ? api.loanApprove.path : api.loanReject.path;
      await apiFetch(routePath(template, loanId), { method: "POST" });
      setNotice(action === "approve" ? "Loan approved." : "Loan rejected.");
      setLoans(await fetchWrappedList<Loan>(api.loans.path));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not reach the server. Check your connection.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const pending = loans.filter((l) => l.status === "PENDING_REVIEW").length;
  const approvedValue = loans
    .filter((l) => ["APPROVED", "DISBURSED", "REPAYING"].includes(l.status))
    .reduce(
      (sum, l) => sum + Number(l.maxApprovedAmount ?? l.principal ?? 0),
      0,
    );

  const visible = useMemo(() => {
    if (filter === "ALL") return loans;
    if (filter === "PENDING")
      return loans.filter((l) => l.status === "PENDING_REVIEW");
    return loans.filter((l) => l.status === filter);
  }, [loans, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Credit desk</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {pending} awaiting review · {fmtKES(approvedValue)} approved
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting review" value={String(pending)} tone="warning" />
        <Stat label="Approved value" value={fmtKES(approvedValue)} tone="brand" />
        <Stat label="Total applications" value={String(loans.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Filter loans">
          {["PENDING", "ALL", "APPROVED", "REJECTED"].map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (filter === f
                  ? "bg-brand-600 text-white"
                  : "border border-ink-200 text-ink-600 hover:bg-ink-50")
              }
            >
              {f === "PENDING" ? "Pending" : f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <Card>
        {loading ? (
          <Empty message="Loading applications…" />
        ) : visible.length === 0 ? (
          <Empty message="No applications in this view." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Loan #</Th>
                <Th className="text-right">Principal</Th>
                <Th className="text-right">Term</Th>
                <Th>Purpose</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((l) => (
                <tr key={l.id} className="hover:bg-ink-50">
                  <Td className="font-mono text-xs">{l.loanNumber}</Td>
                  <Td className="text-right tabular-nums">
                    {fmtKES(l.principal)}
                  </Td>
                  <Td className="text-right tabular-nums">{l.termMonths} mo</Td>
                  <Td className="text-sm">{l.purpose ?? "—"}</Td>
                  <Td>
                    <Badge className={LOAN_STYLES[l.status]}>
                      {humanise(l.status)}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {l.status === "PENDING_REVIEW" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                          disabled={busyId === l.id}
                          onClick={() => decide(l.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                          disabled={busyId === l.id}
                          onClick={() => decide(l.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">—</span>
                    )}
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
`,
);

// ── Admin: transaction monitoring ────────────────────────────────────────
write(
  "admin/transactions/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchList } from "@/lib/client";
import { fmtDateTime, fmtKES } from "@/lib/queries";
import { Badge, Card, Empty, humanise, Table, Td, Th } from "@/components/ui";

type Txn = {
  id: string;
  reference: string;
  type: string;
  accountCode: string;
  description: string | null;
  amount: string | number;
  postedAt: string;
  simulated?: boolean;
};

/**
 * Every ledger posting, platform-wide.
 *
 * /api/ledger/transactions answers with a bare array (ADMIN sees all, an SME
 * its own — tenant scoping is the route's job), so the read goes through
 * fetchList. Each row links through to the reference detail page, which shows
 * the double-entry legs and whether they balance.
 */
export default function AdminTransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchList<Txn>("/api/ledger/transactions")
      .then(setTxns)
      .finally(() => setLoading(false));
  }, []);

  const types = useMemo(
    () => ["ALL", ...Array.from(new Set(txns.map((t) => t.type)))].sort(),
    [txns],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns.filter((t) => {
      if (type !== "ALL" && t.type !== type) return false;
      if (!q) return true;
      return [t.reference, t.accountCode, t.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [txns, query, type]);

  const total = filtered.reduce((s, t) => s + Number(t.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Ledger</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          {filtered.length} postings · {fmtKES(total)} moved
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference, account or description…"
          className="min-w-48 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
          aria-label="Filter by transaction type"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "All types" : t}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {loading ? (
          <Empty message="Loading postings…" />
        ) : filtered.length === 0 ? (
          <Empty message="No postings match this filter." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Ref</Th>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th>Account</Th>
                <Th>Description</Th>
                <Th className="text-right">Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-ink-50">
                  <Td className="font-mono text-xs">
                    <Link
                      href={"/admin/transactions/" + t.reference}
                      className="text-brand-700 hover:underline"
                    >
                      {t.reference}
                    </Link>
                  </Td>
                  <Td>
                    <Badge>{humanise(t.type)}</Badge>
                    {t.simulated && (
                      <span className="ml-1 text-xs text-ink-400">simulated</span>
                    )}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(t.amount)}
                  </Td>
                  <Td className="font-mono text-xs">{t.accountCode}</Td>
                  <Td className="text-sm text-ink-600">{t.description ?? "—"}</Td>
                  <Td className="text-right text-xs">
                    {fmtDateTime(t.postedAt)}
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
`,
);

// ── Admin: reports ───────────────────────────────────────────────────────
write(
  "admin/reports/page.tsx",
  `"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fetchList } from "@/lib/client";
import { fmtKES, fmtNum } from "@/lib/queries";
import { Badge, Card, Empty, Stat, Table, Td, Th, humanise } from "@/components/ui";

type Sale = {
  id: string;
  totalAmount: string | number;
  paymentMethod: string;
};

type Insight = {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
};

/**
 * Reports and insights.
 *
 * The summary is computed from live sales rather than the insights table
 * alone, because that table is empty until SalesPilot has been run — the old
 * page showed "No insights generated yet" even with 35k sales in the
 * database. Both reads are role-scoped by their routes.
 */
export default function AdminReportsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchList<Insight>(api.salesPilotInsights.path),
      fetchList<Sale>(api.sales.path),
    ])
      .then(([i, s]) => {
        setInsights(i);
        setSales(s);
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const revenue = sales.reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);
    const average = sales.length ? revenue / sales.length : 0;
    const methods = new Map<string, number>();
    for (const s of sales) {
      const key = String(s.paymentMethod ?? "UNKNOWN");
      methods.set(key, (methods.get(key) ?? 0) + Number(s.totalAmount ?? 0));
    }
    const top = [...methods.entries()].sort((a, b) => b[1] - a[1])[0];
    return { revenue, average, count: sales.length, top };
  }, [sales]);

  if (loading) {
    return <Empty message="Building report…" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Reports</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Platform performance across {summary.count} recent sales
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue (recent)" value={fmtKES(summary.revenue)} tone="brand" />
        <Stat label="Average sale" value={fmtKES(summary.average)} />
        <Stat label="Sales counted" value={fmtNum(summary.count)} />
        <Stat
          label="Top method"
          value={summary.top ? humanise(summary.top[0]) : "—"}
          hint={summary.top ? fmtKES(summary.top[1]) : undefined}
        />
      </div>

      <Card
        title="AI insights"
        hint="Generated by SalesPilot from sales history"
      >
        {insights.length === 0 ? (
          <Empty message="No generated insights yet. The summary above is computed from live sales regardless." />
        ) : (
          <ul className="space-y-3">
            {insights.map((i) => (
              <li key={i.id} className="border-l-4 border-brand-500 pl-4 py-2">
                <p className="text-sm font-medium text-ink-900">{i.title}</p>
                <p className="mt-0.5 text-sm text-ink-600">{i.body}</p>
                <p className="mt-1 text-xs text-ink-400">
                  <Badge>{humanise(i.type)}</Badge>{" "}
                  {new Date(i.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent sales">
        {sales.length === 0 ? (
          <Empty message="No sales recorded yet." />
        ) : (
          <Table>
            <thead className="bg-ink-50">
              <tr>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sales.slice(0, 20).map((s) => (
                <tr key={s.id}>
                  <Td className="text-sm">{humanise(s.paymentMethod)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {fmtKES(s.totalAmount)}
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
`,
);

// __PART22__
