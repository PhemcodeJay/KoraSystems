import { redirect } from "next/navigation";
import { requireApp, ForbiddenError, type Scope } from "@kora/auth/guards";
import type { AppKey } from "@kora/auth/entitlements";

/**
 * Gate a section behind the subscription tier that pays for it.
 *
 * ── Why a redirect, not a 403 ──────────────────────────────────────────────
 * A locked product is not an error the user caused; it is something they can
 * fix by upgrading. Redirecting to the app hub shows them exactly that — which
 * product is locked, which plan opens it and what it costs — instead of a bare
 * status code with no way forward.
 *
 * `redirect()` throws its own sentinel error to unwind the render, so it is
 * called OUTSIDE the try/catch. Catching it here would swallow the redirect and
 * let the render continue into the locked page.
 */
export async function guardApp(app: AppKey): Promise<Scope | void> {
  let signedOut = false;
  try {
    return await requireApp(app);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    // Same distinction `withAppAccess` makes for APIs: an unauthenticated
    // visitor needs to sign in, an authenticated one needs a different plan.
    // Sending both to /apps would bounce a signed-out visitor to a page they
    // cannot read, and then to /login anyway.
    signedOut = error.message === "Sign in to continue.";
  }
  redirect(signedOut ? "/login" : "/apps");
}