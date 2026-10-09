import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { registerAccount } from "@kora/auth/authenticate";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@kora/auth/session";
import { HOME_FOR_ROLE } from "@kora/auth/guards";

const ROLES = ["SME", "SUPPLIER", "CUSTOMER"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Self-serve registration.
 *
 * Thin validation + cookie wrapper: the Supabase / Prisma work lives in
 * `registerAccount()` inside @kora/auth (where @supabase/supabase-js is
 * installed) rather than in the admin app, which does not depend on it.
 * ADMIN can never self-register here. On success the session cookie is set
 * immediately, so the form can push straight to the role home.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    role?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    businessName?: string;
    companyName?: string;
    password?: string;
  } | null;

  const role = body?.role as (typeof ROLES)[number] | undefined;
  const fullName = body?.fullName?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  const phone = body?.phone?.trim() || null;
  const businessName = body?.businessName?.trim() ?? "";
  const companyName = body?.companyName?.trim() ?? "";
  const password = body?.password ?? "";

  if (!role || !(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json(
      { error: "Choose an account type: business, supplier or shopper." },
      { status: 400 },
    );
  }
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (role === "SME" && !businessName) {
    return NextResponse.json({ error: "Enter your business name." }, { status: 400 });
  }
  if (role === "SUPPLIER" && !companyName) {
    return NextResponse.json({ error: "Enter your company name." }, { status: 400 });
  }

  const result = await registerAccount({
    role,
    fullName,
    email,
    phone,
    businessName,
    companyName,
    password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const demoMode = Boolean(process.env.KORA_DEMO_PASSWORD);
  cookies().set(SESSION_COOKIE, createSessionToken(result.user), sessionCookieOptions);
  return NextResponse.json(
    { ok: true, role: result.user.role, home: HOME_FOR_ROLE[result.user.role], demoMode },
    { status: 201 },
  );
}

