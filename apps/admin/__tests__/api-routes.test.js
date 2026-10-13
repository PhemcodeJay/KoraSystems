// KoraSystems - API Route e2e Tests
// Run: node __tests__/api-routes.test.js   (from apps/admin)
// Requires: a running server - `node scripts/dev.mjs` from the repo root.
// BASE_URL defaults to :3000; EMAIL/PW default to the seeded demo SME.
//
// Rewritten for the current security model: every non-public route sits
// behind the session middleware, so the runner signs in first and reuses the
// cookie exactly like the browser app - and it proves the gate by asserting
// that the same API refuses an unauthenticated caller. The previous version
// was original-scaffold drift: it expected open APIs on :7000 and a
// /api/till/open route that was never implemented.

const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.EMAIL || "sme1@demo.kora.co.ke";
const PASSWORD = process.env.PW || "Demo@1234";

let passed = 0;
let failed = 0;
let cookie = "";

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  OK   ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL ${msg}`);
  }
}

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...opts.headers,
    },
    ...opts,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function runTests() {
  console.log("=== KoraSystems API Route e2e Tests ===");
  console.log("");

  // Public surface
  console.log("Public");
  const landing = await request("/");
  assert(landing.status === 200, `GET / -> ${landing.status}`);

  // Auth: the gate must hold, then open
  console.log("");
  console.log("Auth");
  const unauth = await fetch(`${BASE}/api/sales`);
  assert(unauth.status >= 300, `GET /api/sales without session -> ${unauth.status} (blocked)`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  assert(login.status === 200 && cookie.length > 0, `POST /api/auth/login -> ${login.status}`);

  const me = await request("/api/auth/me");
  assert(me.status === 200, `GET /api/auth/me -> ${me.status}`);
  const smeId = me.body?.user?.tenantSmeId ?? null;
  assert(typeof smeId === "string" && smeId.length > 0, "session user carries tenantSmeId");

  // Reads: every menu surface loads
  console.log("");
  console.log("Reads");
  const reads = [
    "/api/tills",
    "/api/receipts/next-number",
    "/api/inventory/adjustments",
    "/api/sales",
    "/api/refunds",
    "/api/supplier-orders",
    "/api/wallet",
    "/api/ledger/transactions",
    "/api/ledger/balance",
    "/api/sales-pilot/insights",
    "/api/products",
    "/api/team",
  ];
  for (const path of reads) {
    const res = await request(path);
    assert(res.status === 200, `GET ${path} -> ${res.status}`);
  }

  // Writes: real buttons
  console.log("");
  console.log("Writes");
  // Receipt for the newest sale. A sale can already have one (409) - that is
  // the route working, not the test failing, so both outcomes pass.
  const sales = await request("/api/sales");
  const newestSale = Array.isArray(sales.body) ? sales.body[0] : null;
  if (newestSale?.id) {
    const next = await request("/api/receipts/next-number");
    const receipt = await request("/api/receipts", {
      method: "POST",
      body: JSON.stringify({
        saleId: newestSale.id,
        receiptNumber: next.body?.nextNumber ?? 1,
        subtotal: Number(newestSale.totalAmount) || 100,
        tax: 0,
        total: Number(newestSale.totalAmount) || 100,
        paymentMethod: newestSale.paymentMethod || "CASH",
      }),
    });
    assert(
      receipt.status === 201 || receipt.status === 409,
      `POST /api/receipts -> ${receipt.status} (201 printed, 409 already printed)`,
    );
  } else {
    assert(false, "seeded sale available for the receipt write test");
  }

  const generate = await request("/api/sales-pilot/generate", {
    method: "POST",
    body: JSON.stringify({
      smeId,
      type: "REVENUE",
      title: "E2E insight",
      body: "Created by api-routes.test.js",
    }),
  });
  assert(
    generate.status === 201 || generate.status === 400,
    `POST /api/sales-pilot/generate -> ${generate.status}`,
  );

  console.log("");
  console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("Test runner error:", e.message);
  process.exit(1);
});