import { requireScope } from "@kora/auth/guards";
import { SmeView } from "./sme-view";
import { SupplierView } from "./supplier-view";
import { CustomerView } from "./customer-view";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account" };

/**
 * Every profile the signed-in user acts through, on one page.
 *
 * ── Why this renders several views ─────────────────────────────────────────
 * This used to switch on the single `User.role` column and show exactly one. A
 * METAL SME is *granted* SUPPLIER and CUSTOMER — the whole point of the tier —
 * and could never see either here, so the thing they paid extra for had no
 * visible effect anywhere. Each view still guards itself with `requireSme` /
 * `requireSupplier` / `requireCustomer`, so a role is only rendered when the
 * user both holds it and has data behind it.
 */
export default async function AccountPage() {
  const scope = await requireScope("SME", "SUPPLIER", "CUSTOMER", "ADMIN");

  const sections = [];
  if (scope.smeId) sections.push(<SmeView key="sme" />);
  if (scope.supplierId) sections.push(<SupplierView key="supplier" />);
  if (scope.customerId) sections.push(<CustomerView key="customer" />);

  return (
    <div className="space-y-6">
      {sections.length === 0 && (
        <p className="text-sm text-ink-500">
          No trading profile is linked to this account yet. Your details and plan
          are managed by the platform team.
        </p>
      )}

      {sections}

      <PasswordForm forced={scope.user.mustChangePassword} />
    </div>
  );
}
