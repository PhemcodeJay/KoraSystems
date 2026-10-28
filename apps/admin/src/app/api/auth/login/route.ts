import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate } from "@kora/auth/authenticate";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@kora/auth/session";
import { HOME_FOR_ROLE } from "@kora/auth/guards";

// Simple in-memory rate limiter: max 5 attempts per minute per IP.
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= 5) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await authenticate(body.email, body.password);
  if (!user) {
    // Same message for an unknown account and a wrong password, so we do not
    // reveal which addresses exist.
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  cookies().set(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
  return NextResponse.json({ ok: true, role: user.role, home: HOME_FOR_ROLE[user.role] });
}

