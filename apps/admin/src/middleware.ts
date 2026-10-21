import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Route gate for the unified Kora app.
 *
 * Checks only for a valid signed cookie (edge-safe, no DB). The authoritative
 * role check runs server-side in each layout via requireRole(...), so a
 * signed-in user with the wrong role gets a redirect/403 there rather than a
 * silent bounce here.
 *
 * Public: the landing page (/), sign-in (/login), registration (/register),
 * their API routes, and the PWA/metadata files. Everything else needs a
 * session cookie; without one the visitor is sent to /login with `next` set
 * so sign-in can bounce them back.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public: landing, sign-in, registration and their API.
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/api/auth/") ||
    // Safaricom Daraja posts the STK result here from its own infrastructure,
    // with no browser session and no cookie (see
    // app/api/mpesa/callback/route.ts for why it cannot be authenticated).
    // Running it through this gate would 307 it to /login, so Daraja would
    // receive the sign-in HTML instead of the `ResultCode` ack and retry the
    // payment result forever while no pending transaction ever settles.
    pathname === "/api/mpesa/callback"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("kora_session")?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Skip Next internals, static assets and the file-based metadata routes.
   *
   * icon.svg, apple-icon.png, manifest.webmanifest and opengraph-image are
   * served by Next's own handlers; if middleware claimed them, an
   * unauthenticated visitor would get a 307 to /login (HTML) instead of the
   * image, and browsers would cache HTML as the favicon.
   *
   * Anything with a file extension is treated as a static asset.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|opengraph-image|robots|sitemap|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
