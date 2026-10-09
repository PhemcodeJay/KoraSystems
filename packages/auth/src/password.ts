import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with a per-password random salt.
 *
 * Uses Node's built-in scrypt rather than bcrypt/argon2. Two reasons:
 *  - No new dependency. scrypt ships with Node, so there is no native module to
 *    rebuild per platform and nothing extra to audit in a supply chain.
 *  - scrypt is memory-hard by construction. A stolen table cannot be attacked
 *    with cheap parallel GPU guesses the way a bare SHA-256 can be. If a
 *    stronger option is wanted later, the stored format carries its own
 *    parameters, so old hashes stay verifiable.
 *
 * ── Why the parameters travel in the hash ─────────────────────────────────
 * The encoded string is `scrypt$N$r$p$<salt>$<hash>`. N/r/p are recorded
 * per-hash rather than read from constants, so raising the work factor is a
 * rehash-on-next-login (see `needsRehash`) and never a migration that locks
 * every existing user out. Storing a bare hash against global constants would
 * mean a future cost increase could not be applied to stored passwords.
 *
 * ── Never log or return these ────────────────────────────────────────────
 * A hash is a password-equivalent secret. `verifyPassword` returns a boolean
 * and nothing else, and every read path uses an explicit `select` that omits
 * `passwordHash`, so the column cannot reach a response by accident.
 */

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Work factor. 2^15 with r=8 costs ~32MB and ~100ms per hash. */
const PARAMS = { N: 32768, r: 8, p: 1, keylen: 64 } as const;

const SALT_BYTES = 16;
/**
 * scrypt needs roughly 128 * N * r bytes. Node's default 32MB cap is below
 * what N=32768 asks for, so it must be raised explicitly or every hash throws.
 */
const MAXMEM = 128 * PARAMS.N * PARAMS.r * 2;

/** Algorithm tag, so a future migration to argon2 can recognise old hashes. */
const ALGORITHM = "scrypt";

const b64 = (buf: Buffer): string => buf.toString("base64");
const unb64 = (s: string): Buffer => Buffer.from(s, "base64");

export type ScryptParams = { N: number; r: number; p: number; keylen: number };

/**
 * Hash a plaintext password with a freshly generated random salt.
 *
 * Each call generates its own 16-byte salt from the CSPRNG. Salts are not
 * secret — they are stored in the hash string itself — but they must be
 * unique, which is what stops one rainbow table from cracking every account
 * and stops two users with the same password from sharing a hash.
 */
export async function hashPassword(
  plaintext: string,
  params: ScryptParams = PARAMS,
): Promise<string> {
  if (!plaintext) throw new Error("Cannot hash an empty password.");

  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(normalise(plaintext), salt, params.keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: MAXMEM,
  });

  return [ALGORITHM, params.N, params.r, params.p, b64(salt), b64(derived)].join(
    "$",
  );
}

/**
 * Check a plaintext password against a stored hash.
 *
 * Returns false — never throws — for every malformed or unknown input, so a
 * corrupt row cannot crash the sign-in path and turn into a 500 that tells an
 * attacker they found something interesting.
 *
 * The final comparison is `timingSafeEqual`, which is the whole point: a
 * naive `===` on hashes leaks how many leading bytes matched through response
 * timing, letting an attacker recover a hash one byte at a time.
 */
export async function verifyPassword(
  plaintext: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored || !plaintext) return false;

  const parts = stored.split("$");
  if (parts.length !== 6) return false;

  const [algorithm, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  if (algorithm !== ALGORITHM) return false;

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  // Guard the cost parameters before they reach scrypt. They came from a
  // database column, so they are untrusted: a hostile or corrupt row must not
  // be able to request N=2^30 and exhaust the process's memory.
  if (N < 2 || N > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = unb64(hashB64);
    actual = await scryptAsync(normalise(plaintext), unb64(saltB64), expected.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2,
    });
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, so length is compared first.
  // The length of a hash is not a secret.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * True when a stored hash was made with weaker parameters than the current
 * defaults, and so should be replaced on the next successful sign-in.
 *
 * This is how the work factor gets raised without a password reset: verify,
 * notice the hash is stale, re-hash with the current parameters.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== ALGORITHM) return false;
  const [, nRaw, rRaw, pRaw] = parts;
  return (
    Number(nRaw) < PARAMS.N ||
    Number(rRaw) < PARAMS.r ||
    Number(pRaw) < PARAMS.p
  );
}

/**
 * Reject the two canonical wrong passwords and anything trivial.
 *
 * Length is the dominant factor in real-world strength, so the floor is 10
 * characters rather than a fiddly mix of character classes — a rule that
 * pushes people toward `Password1!` is worse than no rule.
 */
export function validatePasswordStrength(plaintext: string): string | null {
  if (!plaintext || plaintext.length < 10) {
    return "Password must be at least 10 characters long.";
  }
  if (plaintext.length > 200) {
    return "Password must be under 200 characters.";
  }
  const lower = plaintext.toLowerCase();
  if (
    ["password", "12345678", "qwerty", "letmein", "welcome"].some((w) =>
      lower.includes(w),
    )
  ) {
    return "That password is too common. Choose something harder to guess.";
  }
  return null;
}

/**
 * Normalise before hashing so a trailing space cannot create a second valid
 * password for the same account. Applied identically on hash and verify, so a
 * password typed with a stray trailing space still signs in.
 */
function normalise(plaintext: string): string {
  return plaintext.normalize("NFKC").trim();
}

