import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";

/** ADMIN-only section. */
export default async function SectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/home");
  }
  return <>{children}</>;
}
