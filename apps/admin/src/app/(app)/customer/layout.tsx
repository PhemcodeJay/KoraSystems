import { redirect } from "next/navigation";
import { requireScope } from "@kora/auth/guards";

/**
 * The customer section.
 *
 * Gated on HOLDING the CUSTOMER role rather than being one by primary role: an
 * SME on the Enterprise tier is granted CUSTOMER, and paid for the right to buy
 * on credit through this section. Requiring `requireRole("CUSTOMER")` sent
 * them straight back to /home, so the tier sold an entitlement the product
 * refused to honour.
 */
export default async function SectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const scope = await requireScope("SME", "SUPPLIER", "CUSTOMER", "ADMIN");
    if (!scope.hasRole("CUSTOMER")) redirect("/home");
  } catch {
    redirect("/home");
  }
  return <>{children}</>;
}
