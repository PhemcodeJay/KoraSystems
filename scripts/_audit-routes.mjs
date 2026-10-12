/**
 * One-off live audit: sign in as a demo SME, then GET every page and every
 * GET-able API route, printing STATUS + path so broken menus/surfaces surface
 * as non-200s. Run with: node scripts/_audit-routes.mjs
 */
const BASE = process.env.BASE || "http://localhost:3000";

const PAGES = [
  "/home", "/pos", "/sme/inventory", "/sme/sales", "/sme/customers",
  "/sme/suppliers", "/sme/onboarding", "/team", "/billing", "/sme/loans",
  "/sme/savings", "/payments", "/supplier/orders", "/supplier/invoices",
  "/neobank", "/neobank/accounts", "/neobank/accounts/create", "/neobank/crypto",
  "/neobank/cards", "/neobank/investments", "/neobank/insurance", "/plans",
  "/growth", "/customer/shop", "/customer/cart", "/account", "/apps",
];

const GETS = [
  "/api/auth/me", "/api/billing", "/api/plans", "/api/products", "/api/sales",
  "/api/customers", "/api/suppliers", "/api/orders", "/api/invoices",
  "/api/team", "/api/tills", "/api/till", "/api/loans", "/api/savings",
  "/api/savings/transactions", "/api/wallet", "/api/ledger/balance",
  "/api/ledger/transactions", "/api/banking/accounts", "/api/cards",
  "/api/crypto", "/api/crypto/balance", "/api/investments", "/api/insurance",
  "/api/smes", "/api/users", "/api/receipts/next-number",
  "/api/inventory/adjustments", "/api/sales-pilot/insights",
  "/api/dashboard/home", "/api/agent/leads", "/api/onboarding/status",
];

const email = process.env.EMAIL || "sme1@demo.kora.co.ke";
const password = process.env.PW || "Demo@1234";

async function main() {
  const cookie = [];
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = login.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) cookie.push(c.split(";")[0]);
  console.log(`LOGIN ${login.status} ${email} (cookies: ${cookie.length})`);
  const cookieHeader = cookie.join("; ");

  const rows = [];
  const targets = [
    ...PAGES.map((p) => ["PAGE", p] as const),
    ...GETS.map((p) => ["GET", p] as const),
  ];
  for (const [kind, path] of targets) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      });
      const flag = res.status >= 400 ? `  <-- ${res.status}` : "";
      rows.push(`${kind.padEnd(4)} ${String(res.status).padEnd(4)} ${path}${flag}`);
    } catch (e) {
      rows.push(`${kind.padEnd(4)} ERR  ${path}  (${e.message})`);
    }
  }
  console.log(rows.join("\n"));
}
main();
