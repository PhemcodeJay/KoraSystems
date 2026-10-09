import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cookie session for the Kora apps.
 *
 * The cookie is HMAC-signed and carries only {userId, role, exp}. The role is
 * re-checked against the database on every read, so tampering with the cookie
 * or demoting a user takes effect immediately rather than at next login.
 *
 * Supabase is the production identity provider; this is the seam where its
 * session JWT would be exchanged for one of these cookies. The demo login is
 * deliberately the same shape, so swapping the credential check in
 * `authenticate()` is the only change needed.
 */

export const SESSION_COOKIE = "kora_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "SME" | "SUPPLIER" | "CUSTOMER" | "ADMIN";
  /**
   * Plan tier and billing status, resolved from `UserPlan` on every read.
   *
   * Carried on the session rather than looked up per request because the nav,
   * the app hub and every entitlement-gated page all need them, and threading
   * a second query through each would be both slower and easier to forget. They
   * are re-read from the database on every request via `getSessionUser`, so a
   * downgrade takes effect immediately rather than at next sign-in — the same
   * reason `role` is re-checked rather than trusted from the cookie.
   */
  planTier?: string;
  planStatus?: string;
  /** Roles held beyond the primary, granted by subscription. */
  grantedRoles?: string[];
  /**
   * Roles the user holds AND has a profile behind.
   *
   * Narrower than `grantedRoles` on purpose: a secondary role with no profile
   * row cannot open anything, so the navigation filters on this and never
   * offers a link that ends in "no profile linked to this account".
   */
  usableRoles?: string[];
  /**
   * Set when an ADMIN resets this account's password.
   *
   * Carried on the session so the `(app)` layout can force the user onto the
   * account page until it is cleared. Without it the flag was written by the
   * admin console and read by nothing, so an admin-issued password quietly
   * became the account's permanent one — the reset existed only on paper.
   */
  mustChangePassword?: boolean;
};

type SessionPayload = {
  userId: string;
  role: SessionUser["role"];
  exp: number;
};

/**
 * Values that ship in `.env.example` and must never be used to sign a real
 * session. Rejected loudly rather than accepted quietly, because a placeholder
 * secret makes every cookie forgeable: the payload is public, so anyone who
 * knows the secret can mint `{userId, role:"ADMIN"}` and authenticate as an
 * administrator against the real database.
 */
const FORBIDDEN_SECRETS = new Set([
  "change-me-to-a-long-random-string",
  "changeme",
  "secret",
  "kora",
  "dev",
]);

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to .env (see .env.example).",
    );
  }
  const normalised = s.trim().toLowerCase();
  if (FORBIDDEN_SECRETS.has(normalised) || normalised.length < 32) {
    throw new Error(
      "SESSION_SECRET is still a placeholder or too short. Generate one with " +
        "`openssl rand -base64 48` and set it in .env. Every role check in " +
        "this platform depends on this value being secret.",
    );
  }
  return s;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Returns the decoded payload, or null if missing, malformed, tampered or expired. */
export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(body));

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
