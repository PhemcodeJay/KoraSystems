import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import { AppShell } from "@/components/dashboard/shell";

/**
 * The single protected layout for the whole platform.
 *
 * This replaces two separate gates — `(dash)/layout.tsx` required ADMIN, and
 * `(account)/layout.tsx` handled everyone else — which is why the admin console
 * and the SME tools could not be reached from one place. There is now one app,
 * one origin and one gate: any signed-in role enters, and each page below
 * re-checks that the role is allowed to see its data.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The authoritative check. Middleware only proves a signed cookie exists (it
  // runs on the edge, where Prisma is unavailable), so role is verified here
  // against the database on every render.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // An administrator reset this account's password. Until the user replaces it
  // with one of their own, the rest of the platform stays off-limits — otherwise
  // the reset is cosmetic and the admin-issued value becomes permanent.
  //
  // `/account` deliberately lives in a different route group with its own
  // layout, so this redirect lands somewhere that does NOT re-enter here and
  // bounce.
  if (user.mustChangePassword) redirect("/account");

  return <AppShell user={user}>{children}</AppShell>;
}