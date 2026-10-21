import { Card } from "@/components/ui";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";
import { fmtKES } from "@/lib/queries";

export default async function AccountsPage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  // Fetch user's accounts
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-ink-900">Bank Accounts</h2>
        <a href="/neobank/accounts/create" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Create Account
        </a>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-ink-500">No accounts yet. Create your first account.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account: any) => (
            <Card key={account.id} title={account.accountName}>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Type</span>
                  <span className="text-sm font-medium text-ink-900 capitalize">{account.accountType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Account Number</span>
                  <span className="text-sm font-medium text-ink-900">{account.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Balance</span>
                  <span className="text-lg font-semibold text-ink-900">{fmtKES(account.balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Currency</span>
                  <span className="text-sm font-medium text-ink-900">{account.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-ink-500">Status</span>
                  <span className={`text-xs font-medium ${account.isActive ? "text-green-600" : "text-gray-600"}`}>
                    {account.isActive ? "Active" : "Inactive"}
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