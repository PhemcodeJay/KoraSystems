import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate } from "@kora/auth/authenticate";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@kora/auth/session";
import { HOME_FOR_ROLE } from "@kora/auth/guards";

export async function POST(request: NextRequest) {
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

