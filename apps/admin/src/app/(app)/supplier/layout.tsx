import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";

/** SUPPLIER / SME / ADMIN-only section. */
export default async function SectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("SUPPLIER", "SME", "ADMIN");
  } catch {
    redirect("/home");
  }
  return <>{children}</>;
}
