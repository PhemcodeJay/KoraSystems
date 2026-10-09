// Password hashing checks. Run: node __tests__/password.test.mjs
// Standalone JS mirroring packages/auth/src/password.ts, so the crypto
// behaviour can be verified without a build step or a database.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const PARAMS = { N: 32768, r: 8, p: 1, keylen: 64 };
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2;
const ALGORITHM = "scrypt";
const b64 = (b) => b.toString("base64");
const unb64 = (s) => Buffer.from(s, "base64");
const normalise = (p) => p.normalize("NFKC").trim();

async function hashPassword(plaintext, params = PARAMS) {
  if (!plaintext) throw new Error("Cannot hash an empty password.");
  const salt = randomBytes(16);
  const derived = await scryptAsync(normalise(plaintext), salt, params.keylen, {
    N: params.N, r: params.r, p: params.p, maxmem: MAXMEM,
  });
  return [ALGORITHM, params.N, params.r, params.p, b64(salt), b64(derived)].join("$");
}

async function verifyPassword(plaintext, stored) {
  if (!stored || !plaintext) return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;
  const [algorithm, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  if (algorithm !== ALGORITHM) return false;
  const N = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 2 || N > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;
  let expected, actual;
  try {
    expected = unb64(hashB64);
    actual = await scryptAsync(normalise(plaintext), unb64(saltB64), expected.length, {
      N, r, p, maxmem: 128 * N * r * 2,
    });
  } catch { return false; }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function needsRehash(stored) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== ALGORITHM) return false;
  const [, n, r, p] = parts;
  return Number(n) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log("  ok   " + msg); }
  else { failed++; console.log("  FAIL " + msg); }
}

const hash = await hashPassword("Demo@1234");
console.log("sample hash:", hash.slice(0, 40) + "...\n");

assert(await verifyPassword("Demo@1234", hash), "correct password verifies");
assert(!(await verifyPassword("demo@1234", hash)), "wrong password rejected");
assert(!(await verifyPassword("", hash)), "empty password rejected");
assert(!(await verifyPassword("Demo@1234", null)), "null hash rejected");
assert(!(await verifyPassword("Demo@1234", undefined)), "undefined hash rejected");
assert(!(await verifyPassword("x", "garbage")), "malformed hash rejected, no throw");
assert(!(await verifyPassword("x", "a$b$c$d$e$f$g")), "wrong field count rejected");
assert(!(await verifyPassword("x", "argon2$32768$8$1$AAAA$AAAA")), "unknown algorithm rejected");
assert(
  !(await verifyPassword("x", "scrypt$99999999$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA")),
  "hostile N=99M rejected before allocation",
);
assert(
  !(await verifyPassword("x", "scrypt$32768$0$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA")),
  "zero r rejected",
);
assert(!(await verifyPassword("x", "scrypt$abc$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA")), "non-numeric N rejected");

// The salt must differ per hash, otherwise identical passwords share a hash
// and one rainbow table cracks every account at once.
const h1 = await hashPassword("same-password");
const h2 = await hashPassword("same-password");
assert(h1 !== h2, "same password produces different hashes (unique salt)");
assert(await verifyPassword("same-password", h1) && await verifyPassword("same-password", h2),
  "both salted hashes verify independently");
assert(h1.split("$")[4] !== h2.split("$")[4], "salt segments differ");
assert(!h1.includes("same-password"), "plaintext absent from stored hash");

// Trailing whitespace must not create a second valid password.
assert(await verifyPassword("Demo@1234 ", hash), "trailing space normalised on verify");

assert(needsRehash("scrypt$1024$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA") === true, "weak params flagged for rehash");
assert(needsRehash(hash) === false, "current params not flagged");
assert(needsRehash(null) === false, "null not flagged for rehash");

let threw = false;
try { await hashPassword(""); } catch { threw = true; }
assert(threw, "hashing empty password throws");

const t0 = Date.now();
await hashPassword("bench");
console.log(`\n  hash cost: ${Date.now() - t0}ms`);

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
