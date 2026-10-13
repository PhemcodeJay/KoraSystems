$f = 'c:/Users/Phemcode/Documents/Jobs/Clients/KoraSystemsInc/KoraSystems/scripts/_audit-routes.mjs'
$content = @'
/**
 * One-off live audit: sign in as a demo SME, then GET every page and every
 * GET-able API route, printing STATUS + path so broken menus/surfaces surface
 * as non-200s. Run with: node scripts/_audit-routes.mjs
 *
 * Every fetch is bounded with a client-side timeout so a stalled query can
 * never hang the whole audit.
 */
const BASE = process.env.BASE || "http://localhost:3000";

/** A fetch that rejects (then fails that one row) instead of hanging forever. */
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const PAGES = [
  "/home",
  "/pos",
  "/sme/inventory",
  "/sme/sales",
  "/sme/customers",
  "/sme/suppliers",
  "/sme/onboarding",
  "/team",
  "/billing",
  "/sme/loans",
  "/sme/savings",
  "/payments",
  "/supplier/orders",
  "/supplier/invoices",
  "/neobank",
  "/neobank/accounts",
  "/neobank/accounts/create",
  "/neobank/crypto",
  "/neobank/cards",
  "/neobank/investments",
  "/neobank/insurance",
  "/plans",
  "/growth",
  "/customer/shop",
  "/customer/cart",
  "/account",
  "/apps",
];

const GETS = [
  "/api/auth/me",
  "/api/billing",
  "/api/plans",
  "/api/products",
  "/api/sales",
  "/api/customers",
  "/api/suppliers",
  "/api/orders",
  "/api/invoices",
  "/api/team",
  "/api/tills",
  "/api/till",
  "/api/loans",
  "/api/savings",
  "/api/savings/transactions",
  "/api/wallet",
  "/api/ledger/balance",
  "/api/ledger/transactions",
  "/api/banking/accounts",
  "/api/cards",
  "/api/crypto",
  "/api/crypto/balance",
  "/api/investments",
  "/api/insurance",
  "/api/smes",
  "/api/users",
  "/api/receipts/next-number",
  "/api/inventory/adjustments",
  "/api/sales-pilot/insights",
  "/api/dashboard/home",
  "/api/agent/leads",
  "/api/onboarding/status",
];

const email = process.env.EMAIL || "sme1@demo.kora.co.ke";
const password = process.env.PW || "Demo@1234";

async function main() {
  const rows = [];

  // --- Auth: the gate must hold, then open -----------------------------------
  const login = await fetchWithTimeout(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, 12000);

  const setCookie = login.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");

  rows.push(`LOGIN ${login.status} ${email} (cookies: ${setCookie.length})`);

  // --- Reads: every menu surface loads --------------------------------------
  const readTargets = GETS.map((path) => ["GET", path]);

  for (const [kind, path] of readTargets) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      }, 12000);
      const flag = res.status >= 400 ? `  <-- ${res.status}` : "";
      rows.push(`${kind.padEnd(4)} ${String(res.status).padEnd(4)} ${path}${flag}`);
    } catch (e) {
      rows.push(`${kind.padEnd(4)} ERR  ${path}  (${e.message})`);
    }
  }

  // --- Pages: every surfaced route is a real page ---------------------------
  const pageTargets = PAGES.map((p) => ["PAGE", p]);
  for (const [kind, path] of pageTargets) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      }, 12000);
      const flag = res.status >= 400 ? `  <-- ${res.status}` : "";
      rows.push(`${kind.padEnd(4)} ${String(res.status).padEnd(4)} ${path}${flag}`);
    } catch (e) {
      rows.push(`${kind.padEnd(4)} ERR  ${path}  (${e.message})`);
    }
  }

  console.log(rows.join("\n"));
}

main().catch((err) => {
  console.error("AUDIT CRASH:", err);
  process.exit(1);
});
'@

Set-Content -Path $f -Value $content -Encoding UTF8
Write-Output 'audit-script-written-bytes=' + $content.Length
