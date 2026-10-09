import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Edge-safe route gate.
 *
 * Runs in middleware, where the Prisma client is unavailable (no native
 * bindings on the edge runtime). It therefore only checks that a valid,
 * unexpired, correctly-signed cookie is present — the authoritative role
 * check happens server-side in the page/layout via `requireRole`.
 *
 * A user with a valid cookie but the wrong role therefore reaches the page
 * shell and is rejected there with a 403, rather than leaking the route.
 */
export function requireSession(
  request: NextRequest,
  opts: { loginPath?: string } = {},
): NextResponse | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (payload) return null;

  const loginPath = opts.loginPath ?? "/login";
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  // Preserve where they were headed so login can bounce them back.
  if (request.nextUrl.pathname !== loginPath) {
    url.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}
