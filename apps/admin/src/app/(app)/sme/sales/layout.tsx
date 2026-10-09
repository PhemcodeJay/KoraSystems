import { guardApp } from "@/lib/entitlement-guard";

/**
 * SalesPilot.
 *
 * A Server Component layout wrapping a Client Component page: the guard has to
 * run on the server, and the page itself cannot, so the check lives here. The
 * page had no entitlement check at all, which meant SalesPilot — the free
 * entry tier, but still a product — was open to every signed-in account
 * regardless of their plan.
 */
export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardApp("salespilot");
  return <>{children}</>;
}