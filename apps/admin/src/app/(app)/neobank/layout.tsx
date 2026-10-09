import { guardApp } from "@/lib/entitlement-guard";
import { NeobankTabs } from "./tabs";

export default async function NeobankLayout({ children }: { children: React.ReactNode }) {
  // The whole section is the Neobank product, so the entitlement is checked
  // once here rather than on eight pages. Previously nothing checked it: the
  // plan ladder advertised Neobank at the top tier while the pages below were
  // open to every signed-in account.
  //
  // This replaces a `withAuth` call that returned a `NextResponse` from a
  // layout — layouts may only return JSX or redirect, so that branch rendered
  // an empty page rather than anything useful. `guardApp` covers the same case
  // and redirects to /login instead.
  await guardApp("neobank");

  return (
    <div className="space-y-6">
      <NeobankTabs />
      {children}
    </div>
  );
}