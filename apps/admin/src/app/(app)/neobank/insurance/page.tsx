import { Card } from "@/components/ui";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";

export default async function InsurancePage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's insurance policies
  const policies = await prisma.insurancePolicy.findMany({
    where: { userId: user.id },
    orderBy: { expiryDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Insurance Marketplace</h2>
          <p className="mt-1 text-sm text-ink-500">Protect your assets with our partners</p>
        </div>
        <a
          href="/neobank/insurance/quote"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Get a Quote
        </a>
      </div>

      {policies.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-ink-500">No active policies. Get covered today!</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy: any) => (
            <Card key={policy.id} title={policy.policyName}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Provider</span>
                  <span className="text-sm font-medium text-ink-900">{policy.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Type</span>
                  <span className="text-sm font-medium text-ink-900 capitalize">{policy.policyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Premium</span>
                  <span className="text-sm font-medium text-ink-900">KES {Number(policy.premium).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Status</span>
                  <span className={`text-xs font-medium ${policy.status === "active" ? "text-green-600" : "text-gray-600"}`}>
                    {policy.status.charAt(0).toUpperCase() + policy.status.slice(1)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}