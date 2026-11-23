import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout for the per-account view. Accepts any signed-in role — the content
 * is scoped by `requireSme` / `requireSupplier` / `requireCustomer` on the
 * page itself, so an SME can never reach a supplier's data here.
 */
export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Admins use the platform dashboard, not this view.
  if (user.role === "ADMIN") redirect("/home");

  return <AccountShell user={user}>{children}</AccountShell>;
}
