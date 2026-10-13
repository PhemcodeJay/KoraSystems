/**
 * One-off live audit of BUTTON actions (mutations). Signs in as a demo SME and
 * exercises the POST/DELETE handlers behind real buttons, printing STATUS +
 * label so a broken action surfaces as a non-2xx. Read-only-safe where noted;
 * the writes are small and against the seeded demo tenant. Run:
 *   node scripts/_audit-actions.mjs
 */
const BASE = process.env.BASE || "http://localhost:3000";
const email = process.env.EMAIL || "sme1@demo.kora.co.ke";
const password = process.env.PW || "Demo@1234";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  console.log(`LOGIN ${login.status}`);

  const results = [];
  const call = async (label, method, path, body) => {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json", cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      let snippet = "";
      try {
        const t = await res.text();
        snippet = t.slice(0, 120).replace(/\s+/g, " ");
      } catch {}
      results.push(`${label.padEnd(28)} ${method.padEnd(6)} ${String(res.status).padEnd(4)} ${path}${snippet ? "  " + snippet : ""}`);
    } catch (e) {
      results.push(`${label.padEnd(28)} ${method.padEnd(6)} ERR  ${path} (${e.message})`);
    }
  };

  // 1. Products — "Add product" button.
  const sku = `AUDIT-${Date.now().toString(36).toUpperCase()}`;
  let productId = null;
  const addProd = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ name: "Audit Item", sku, price: 100, stockQuantity: 50, category: "Test" }),
  });
  try {
    const j = await addProd.json();
    productId = j?.data?.id ?? j?.id ?? null;
  } catch {}
  results.push(`${"create product".padEnd(28)} POST    ${String(addProd.status).padEnd(4)} /api/products  id=${productId}`);

  // 2. Sale — "Complete sale" / POS checkout.
  if (productId) {
    await call("record sale", "POST", "/api/sales", {
      items: [{ productId, quantity: 1, unitPrice: 100 }],
      paymentMethod: "CASH",
    });
  }

  // 3. Team — "Invite" button.
  await call("invite team member", "POST", "/api/team", {
    email: `audit-${Date.now().toString(36)}@demo.kora.co.ke`,
    role: "CASHIER",
  });

  // 4. Inventory adjust — "Adjust stock" button.
  if (productId) {
    await call("adjust inventory", "POST", "/api/inventory/adjust", {
      productId,
      direction: "in",
      quantity: 5,
      reason: "Audit restock",
    });
  }

  // 5. Loans — "Apply" button.
  await call("apply for loan", "POST", "/api/loans/apply", {
    principal: 20000,
    purpose: "Audit working capital",
    termMonths: 6,
  });

  // 6. Savings — "Deposit" button.
  await call("savings deposit", "POST", "/api/savings/deposit", {
    amount: 500,
    method: "MPESA_STK",
  });

  // 7. Payments — P2P endpoint. No UI button calls it (API-only), so exercise
  // it directly: a funded caller-owned source account paying into another
  // account number.
  const acctList = await fetch(`${BASE}/api/banking/accounts`, { headers: { cookie } });
  let accounts = [];
  try { accounts = (await acctList.json()).accounts ?? []; } catch {}
  const srcAcct = accounts.find((a) => Number(a.balance) >= 100) ?? null;
  let dstAcct = accounts.find((a) => srcAcct && a.id !== srcAcct.id) ?? null;
  if (srcAcct && !dstAcct) {
    const mk = await fetch(`${BASE}/api/banking/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ name: "Audit P2P Dest", type: "CHECKING", currency: "KES" }),
    });
    try { dstAcct = (await mk.json())?.account ?? null; } catch {}
  }
  if (srcAcct && dstAcct) {
    await call("p2p payment", "POST", "/api/payments/p2p", {
      fromAccountId: srcAcct.id,
      toAccountNumber: dstAcct.accountNumber,
      amount: 100,
      reference: "Audit P2P",
    });
  } else {
    results.push(`${"p2p payment".padEnd(28)} SKIP  no funded source account available`);
  }

  // 8. Neobank — create account button.
  await call("create bank account", "POST", "/api/banking/accounts", {
    name: "Audit Account",
    type: "CHECKING",
    currency: "KES",
  });

  // 9. Billing checkout — "Start trial" button.
  await call("start trial (checkout)", "POST", "/api/billing/checkout", {
    tier: "STANDARD",
    cycle: "MONTHLY",
  });

  // 10. Auth — change-password button. Exercised against a throwaway account:
  // the shared demo password is 9 characters but the route (and the form) both
  // require at least 10, so rotating it would fail and, if it could pass, break
  // the seeded demo credentials anyway.
  const pwEmail = `audit-pw-${Date.now().toString(36)}@demo.kora.co.ke`;
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: "CUSTOMER",
      fullName: "Audit PW Tester",
      email: pwEmail,
      password: "AuditPass@123",
    }),
  });
  results.push(`${"register (pw-test user)".padEnd(28)} POST    ${String(reg.status).padEnd(4)} /api/auth/register`);
  const regCookie = (reg.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (reg.status === 201 && regCookie) {
    const cp = await fetch(`${BASE}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: regCookie },
      body: JSON.stringify({ currentPassword: "AuditPass@123", newPassword: "AuditPass@1234" }),
    });
    let cpSnippet = "";
    try { cpSnippet = (await cp.text()).slice(0, 120).replace(/\s+/g, " "); } catch {}
    results.push(`${"change password".padEnd(28)} POST    ${String(cp.status).padEnd(4)} /api/auth/change-password${cpSnippet ? "  " + cpSnippet : ""}`);
  } else {
    results.push(`${"change password".padEnd(28)} SKIP  could not create throwaway account`);
  }

  // 11. Logout — sign out button.
  await call("sign out", "POST", "/api/auth/logout");

  console.log(results.join("\n"));
}
main();
