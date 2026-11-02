import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import { NeobankTabs } from "./tabs";

export default async function NeobankLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Neobank is an Enterprise (METAL) feature that is currently in private
  // preview. The code stays in the repo, but the surface is hidden from
  // everyone except the SaaS admin, who can activate it for the platform.
  if (user.role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Coming soon
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">
            Neobank is in private preview
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Business accounts, cards, savings and SME credit are being readied for
            Enterprise customers. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NeobankTabs />
      {children}
    </div>
  );
}