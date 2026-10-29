import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate } from "@kora/auth/authenticate";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@kora/auth/session";
import { HOME_FOR_ROLE } from "@kora/auth/guards";

// Login rate limiter (in-memory, per process).
//
// We count *failed* attempts only, so a legitimate user who signs in
// successfully is never locked out by their own traffic. Limits are applied
// independently per client IP and per (lower-cased) email address, which
// mitigates both distributed password spraying and targeted brute force.
const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60_000);
const MAX_FAILURES = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5);
const LOCKOUT_MS = Number(process.env.LOGIN_RATE_LIMIT_LOCKOUT_MS ?? 15 * 60_000);

interface FailureRecord {
  timestamps: number[];
  lockedUntil: number;
}

const byIp = new Map<string, FailureRecord>();
const byEmail = new Map<string, FailureRecord>();

function getRecord(store: Map<string, FailureRecord>, key: string): FailureRecord {
  let rec = store.get(key);
  if (!rec) {
    rec = { timestamps: [], lockedUntil: 0 };
    store.set(key, rec);
  }
  return rec;
}

function prune(rec: FailureRecord, now: number): void {
  rec.timestamps = rec.timestamps.filter((t) => now - t < WINDOW_MS);
  if (rec.lockedUntil && rec.lockedUntil <= now) rec.lockedUntil = 0;
}

function isLocked(store: Map<string, FailureRecord>, key: string, now: number): { locked: boolean; retryAfter: number } {
  const rec = store.get(key);
  if (!rec) return { locked: false, retryAfter: 0 };
  prune(rec, now);
  if (rec.lockedUntil && rec.lockedUntil > now) {
    return { locked: true, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  if (rec.timestamps.length >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCKOUT_MS;
    return { locked: true, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { locked: false, retryAfter: 0 };
}

function recordFailure(store: Map<string, FailureRecord>, key: string, now: number): void {
  const rec = getRecord(store, key);
  prune(rec, now);
  rec.timestamps.push(now);
  if (rec.timestamps.length >= MAX_FAILURES) {
    rec.lockedUntil = now + LOCKOUT_MS;
  }
}

function recordSuccess(store: Map<string, FailureRecord>, key: string): void {
  store.delete(key);
}

// Periodic cleanup to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of byIp) {
    prune(rec, now);
    if (!rec.timestamps.length && !rec.lockedUntil) byIp.delete(k);
  }
  for (const [k, rec] of byEmail) {
    prune(rec, now);
    if (!rec.timestamps.length && !rec.lockedUntil) byEmail.delete(k);
  }
}, 5 * 60_000).unref?.();

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();

  // Check IP lockout first.
  const ipStatus = isLocked(byIp, ip, now);
  if (ipStatus.locked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(ipStatus.retryAfter) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Check email lockout.
  const emailStatus = isLocked(byEmail, email, now);
  if (emailStatus.locked) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(emailStatus.retryAfter) } },
    );
  }

  const user = await authenticate(body.email, body.password);
  if (!user) {
    // Record failure against both IP and email.
    recordFailure(byIp, ip, now);
    recordFailure(byEmail, email, now);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  // Success: clear any prior failure state.
  recordSuccess(byIp, ip);
  recordSuccess(byEmail, email);

  cookies().set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
  return NextResponse.json({ ok: true, role: user.role, home: HOME_FOR_ROLE[user.role] });
}

