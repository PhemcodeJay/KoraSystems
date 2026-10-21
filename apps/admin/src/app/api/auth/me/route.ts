import { NextResponse } from "next/server";
import { getSessionUser } from "@kora/auth";

/**
 * The current signed-in user, or 401.
 *
 * The `api` client in @kora/api references this endpoint, and client apps use
 * it to decide whether to render a session or bounce to sign-in. It sits under
 * /api/auth/ so middleware lets it through unauthenticated and the handler
 * decides — that is the point of the endpoint.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  return NextResponse.json({ user });
}
