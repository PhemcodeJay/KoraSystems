import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import { SmeHome } from "../sme-home";
import { SupplierHome } from "../supplier-home";
import { CustomerHome } from "../customer-home";
import { AdminHome } from "../admin-home";

export const dynamic = "force-dynamic";

/**
 * One entry point for every role, at /home.
 *
 * `/` is the public Kora Systems landing page, so the signed-in dashboard
 * lives here instead. Previously each role had its own dashboard in its own
 * app on its own port, so moving between them meant a different origin and a
 * fresh login. This page routes each signed-in role to its section inside the
 * same app.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Rendered as elements, not called: these are async Server Components, and
  // React resolves the returned promise itself.
  if (user.role === "ADMIN") return <AdminHome />;
  if (user.role === "SUPPLIER") return <SupplierHome />;
  if (user.role === "CUSTOMER") return <CustomerHome />;
  return <SmeHome />;
}