import { redirect } from "next/navigation";
import { requireRole } from "@kora/auth/guards";

/**
 * SME-only section.
 *
 * The unified shell hides these links from other roles, but that is presentation
 * only. The guard is the authority: an SME token hitting /sme/loans is refused
 * here rather than trusting the nav to have done its job.
 */
export default async function SmeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("SME", "ADMIN");
  } catch {
    redirect("/home");
  }
  return <>{children}</>;
}