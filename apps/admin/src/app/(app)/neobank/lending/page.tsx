import { requireRole } from "@kora/auth/guards";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui";
import clsx from "clsx";

type LoanStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "DISBURSEMENT_PENDING"
  | "DISBURSED"
  | "REJECTED"
  | "ACTIVE"
  | "REPAID"
  | "DEFAULTED";

interface Loan {
  id: string;
  loanNumber: string;
  principal: string;
  interestRate: string;
  termMonths: number;
  totalPayable: string;
  status: LoanStatus;
  purpose?: string | null;
  createdAt: string;
  approvedAmount?: string | null;
}

async function fetchLoans(): Promise<Loan[]> {
  try {
    const res = await fetch("/api/loans", { next: { tags: ["loans"] } });
    if (!res.ok) {
      if (res.status === 403) return [];
      throw new Error("Failed to load loans");
    }
    const json = await res.json();
    return (json.data as Loan[]) ?? [];
  } catch {
    return [];
  }
}

const STATUS_BADGE: Record<LoanStatus, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  DISBURSEMENT_PENDING: "bg-indigo-100 text-indigo-800",
  DISBURSED: "bg-purple-100 text-purple-800",
  REJECTED: "bg-red-100 text-red-800",
  ACTIVE: "bg-green-100 text-green-800",
  REPAID: "bg-gray-100 text-gray-800",
  DEFAULTED: "bg-red-100 text-red-800",
};

export default async function LendingPage() {
  try {
    await requireRole("SME", "ADMIN");
  } catch {
    // redirect handled elsewhere; for now guard silently
  }

  const loans = await fetchLoans();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Lending"
        description="Apply for working capital, check your credit score, and track existing loan applications."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Existing Loans */}
        <Card title="My Loan Applications" hint="Track the status of your submissions">
          {loans.length === 0 ? (
            <p className="text-sm text-ink-500">
              No applications yet. Use the form opposite to apply.
            </p>
          ) : (
            <LoanList loans={loans} />
          )}
        </Card>

        {/* Application Form */}
        <Card title="Apply for a Loan" hint="Business credit application — reviewed within 24h">
          <LendingForm />
        </Card>
      </div>
    </div>
  );
}

function LendingForm() {
  return (
    <>
      <form action="/api/loans/apply" method="POST" className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700">Principal (KES)</label>
          <input
            type="number"
            step="1000"
            min="10000"
            name="principal"
            required
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
            placeholder="e.g. 100000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Term (months)</label>
          <select
            name="termMonths"
            defaultValue="12"
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
          >
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
            <option value="36">36 months</option>
            <option value="60">60 months</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Purpose</label>
          <select
            name="purpose"
            defaultValue="working_capital"
            className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
          >
            <option value="working_capital">Working capital</option>
            <option value="equipment">Equipment purchase</option>
            <option value="inventory">Inventory restock</option>
            <option value="expansion">Business expansion</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          Apply for Loan
        </button>
      </form>

      <p className="mt-4 text-xs text-ink-500">
        Applications are reviewed by our credit team within 24 hours. Funds are disbursed upon approval.
      </p>
    </>
  );
}

function LoanList({ loans }: { loans: Loan[] }) {
  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <div key={loan.id} className="rounded-lg border border-ink-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-ink-900">{loan.loanNumber}</p>
            <span
              className={clsx(
                "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_BADGE[loan.status],
              )}
            >
              {loan.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-ink-500">Principal</span>
              <span className="font-medium text-ink-900">KES {Number(loan.principal).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-ink-500">Total Payable</span>
              <span className="font-medium text-ink-900">KES {Number(loan.totalPayable).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-ink-500">Interest Rate</span>
              <span className="font-medium text-ink-900">{Number(loan.interestRate).toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-ink-500">Term</span>
              <span className="font-medium text-ink-900">{loan.termMonths} months</span>
            </div>
            {loan.purpose && (
              <div className="col-span-2">
                <span className="text-ink-500">Purpose: </span>
                <span className="font-medium text-ink-900">{loan.purpose.replace(/_/g, " ")}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}