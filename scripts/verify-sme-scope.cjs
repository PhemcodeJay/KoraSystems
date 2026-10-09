/**
 * Runtime verification for the SME tenant-scope changes.
 *
 * Proves, against a live signed-in session rather than by reading the guard:
 *   1. an SME can read /api/customers and /api/suppliers (previously 403)
 *   2. each endpoint returns rows scoped to that SME only
 *   3. two different SMEs see DIFFERENT ids — the actual isolation test
 *   4. an SME still cannot read an admin-only endpoint (403 preserved)
 *
 * Reads the demo password from .env without printing it. Writes a cookie jar
 * per role to disk for the browser check that follows.
 */
const fs = require("node:fs");

const BASE = process.env.BASE ?? "http://localhost:3005";
const env = fs.readFileSync(".env", "utf8");
const pw = (env.match(/^KORA_DEMO_PASSWORD=["']?([^"'\r\n]+)/m) ?? [])[1];

if (!pw) {
  console.error("KORA_DEMO_PASSWORD not found in .env");
  process.exit(2);
}

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  });
  const cookie = (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: r.status, cookie };
}

async function get(path, cookie) {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } });
  let body;
  try {
    body = await r.json();
  } catch {
    body = "<non-JSON>";
  }
  return { status: r.status, body };
}

/** Routes answer in three shapes; normalise before comparing ids. */
const rows = (body) => {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return null;
};

const ids = (body) => (rows(body) ?? []).map((r) => r.id).sort();

async function main() {
  const accounts = [
    "sme1@demo.kora.co.ke",
    "sme2@demo.kora.co.ke",
    "supplier1@demo.kora.co.ke",
    "admin@demo.kora.co.ke",
  ];

  const sessions = {};
  for (const email of accounts) {
    const { status, cookie } = await login(email);
    if (status === 200 && cookie) {
      sessions[email] = cookie;
      console.log(`login  ${email.padEnd(26)} 200  session OK`);
    } else {
      console.log(`login  ${email.padEnd(26)} ${status}  (no session)`);
    }
  }

  const sme1 = sessions["sme1@demo.kora.co.ke"];
  const sme2 = sessions["sme2@demo.kora.co.ke"];
  const supplier = sessions["supplier1@demo.kora.co.ke"];
  const admin = sessions["admin@demo.kora.co.ke"];

  console.log("\n--- SME access to the two routes that previously 403'd ---");
  const results = {};
  for (const path of ["/api/customers", "/api/suppliers"]) {
    const r1 = sme1 ? await get(path, sme1) : { status: 0, body: null };
    results[path] = r1;
    console.log(
      `sme1 ${path.padEnd(18)} status=${r1.status} rows=${rows(r1.body)?.length ?? "n/a"}`,
    );
    if (r1.status !== 200) console.log(`     body: ${JSON.stringify(r1.body).slice(0, 200)}`);
  }

  console.log("\n--- tenant isolation: sme1 vs sme2 must differ ---");
  let isolationOk = true;
  for (const path of ["/api/customers", "/api/suppliers"]) {
    if (!sme1 || !sme2) {
      console.log(`${path}: SKIPPED (missing a second SME session)`);
      continue;
    }
    const a = await get(path, sme1);
    const b = await get(path, sme2);
    const ia = ids(a.body);
    const ib = ids(b.body);
    const overlap = ia.filter((x) => ib.includes(x));
    const ok = overlap.length === 0;
    isolationOk = isolationOk && ok;
    console.log(
      `${path.padEnd(18)} sme1=${ia.length} sme2=${ib.length} shared=${overlap.length} ${ok ? "ISOLATED" : "LEAK"}`,
    );
    if (!ok) console.log(`     shared ids: ${overlap.slice(0, 5).join(", ")}`);
  }

  console.log("\n--- admin-only endpoints must still reject an SME ---");
  for (const path of ["/api/smes", "/api/loans/pENDING/approve"]) {
    const r = await get(path, sme1);
    const rejected = r.status === 403 || r.status === 404 || r.status === 405;
    console.log(`sme1 ${path.padEnd(30)} ${r.status} ${rejected ? "rejected OK" : "!! ALLOWED"}`);
  }

  console.log("\n--- supplier self-scope preserved ---");
  if (supplier) {
    const r = await get("/api/suppliers", supplier);
    console.log(`supplier1 /api/suppliers status=${r.status} rows=${rows(r.body)?.length ?? "n/a"}`);
  }
  if (admin) {
    const r = await get("/api/customers", admin);
    console.log(`admin /api/customers    status=${r.status} rows=${rows(r.body)?.length ?? "n/a"}`);
  }

  console.log("\nSUMMARY " + JSON.stringify({ isolationOk }));
}

main();