// KoraSystems — API Route e2e Tests
// Run: node __tests__/api-routes.test.js
// Requires: running Next.js server (pnpm dev)

const BASE = process.env.BASE_URL || "http://localhost:7000";

let passed = 0;
let failed = 0;

async function request(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

async function runTests() {
  console.log("=== KoraSystems API Route e2e Tests ===\n");

  // ── Health Check ──
  console.log("Health Check");
  const health = await request("/");
  assert(health.status === 200, `GET / → ${health.status}`);

  // ── Till Routes ──
  console.log("\nTill Routes");
  const tillOpen = await request("/api/till/open", { method: "POST", body: JSON.stringify({ name: "TestTill", openingBalance: 1000 }) });
  assert(tillOpen.status === 200 || tillOpen.status === 201, `POST /api/till/open → ${tillOpen.status}`);

  const tills = await request("/api/tills");
  assert(tills.status === 200, `GET /api/tills → ${tills.status}`);
  if (tills.body?.tills) assert(Array.isArray(tills.body.tills), "GET /api/tills returns array");

  // ── Receipt Routes ──
  console.log("\nReceipt Routes");
  const nextNum = await request("/api/receipts/next-number");
  assert(nextNum.status === 200, `GET /api/receipts/next-number → ${nextNum.status}`);
  if (nextNum.body?.nextNumber) assert(Number.isInteger(nextNum.body.nextNumber), "nextNumber is integer");

  const receipt = await request("/api/receipts", { method: "POST", body: JSON.stringify({ saleId: "test-sale", receiptNumber: nextNum.body?.nextNumber || 1, subtotal: 100, tax: 10, total: 110, paymentMethod: "CASH" }) });
  assert(receipt.status === 200 || receipt.status === 201, `POST /api/receipts → ${receipt.status}`);

  // ── Inventory Routes ──
  console.log("\nInventory Routes");
  const adjust = await request("/api/inventory/adjust", { method: "POST", body: JSON.stringify({ productId: "test-product", adjustmentType: "in", quantity: 10, reason: "test", userId: "test-user" }) });
  assert(adjust.status === 200 || adjust.status === 201, `POST /api/inventory/adjust → ${adjust.status}`);

  const adjustments = await request("/api/inventory/adjustments");
  assert(adjustments.status === 200, `GET /api/inventory/adjustments → ${adjustments.status}`);

  // ── Sales Routes ──
  console.log("\nSales Routes");
  const sales = await request("/api/sales");
  assert(sales.status === 200, `GET /api/sales → ${sales.status}`);

  // ── Refund Routes ──
  console.log("\nRefund Routes");
  const refunds = await request("/api/refunds");
  assert(refunds.status === 200, `GET /api/refunds → ${refunds.status}`);

  // ── Supplier Orders Routes ──
  console.log("\nSupplier Orders Routes");
  const orders = await request("/api/supplier-orders");
  assert(orders.status === 200, `GET /api/supplier-orders → ${orders.status}`);

  // ── Wallet Routes ──
  console.log("\nWallet Routes");
  const wallet = await request("/api/wallet");
  assert(wallet.status === 200, `GET /api/wallet → ${wallet.status}`);

  // ── Ledger Routes ──
  console.log("\nLedger Routes");
  const ledger = await request("/api/ledger/transactions");
  assert(ledger.status === 200, `GET /api/ledger/transactions → ${ledger.status}`);

  // ── SalesPilot Routes ──
  console.log("\nSalesPilot Routes");
  const insights = await request("/api/sales-pilot/insights");
  assert(insights.status === 200, `GET /api/sales-pilot/insights → ${insights.status}`);

  const generate = await request("/api/sales-pilot/generate", { method: "POST", body: JSON.stringify({ smeId: "test-sme", type: "REVENUE", title: "Test", body: "Test insight" }) });
  assert(generate.status === 200 || generate.status === 201, `POST /api/sales-pilot/generate → ${generate.status}`);

  const sync = await request("/api/sales-pilot/sync");
  assert(sync.status === 200, `GET /api/sales-pilot/sync → ${sync.status}`);

  const syncPost = await request("/api/sales-pilot/sync", { method: "POST", body: JSON.stringify({ action: "sync_customer", data: { userId: "test-user", fullName: "Test User" } }) });
  assert(syncPost.status === 200 || syncPost.status === 201, `POST /api/sales-pilot/sync → ${syncPost.status}`);

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("Test runner error:", e.message);
  process.exit(1);
});