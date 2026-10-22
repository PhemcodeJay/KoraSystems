import { Card } from "@/components/ui";
import { requireRole } from "@kora/auth/guards";
import { prisma } from "@kora/database";

export default async function InsuranceQuotePage() {
  const user = await requireRole("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Get a Quote</h2>
          <p className="mt-1 text-sm text-ink-500">
            Protect your assets with our insurance partners
          </p>
        </div>
        <a
          href="/neobank/insurance"
          className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Back to policies
        </a>
      </div>

      <Card title="Request a Quote" hint="Select the type of coverage you need">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700">Coverage Type</label>
            <select className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm">
              <option value="health">Health Insurance</option>
              <option value="auto">Auto Insurance</option>
              <option value="travel">Travel Insurance</option>
              <option value="device">Device Insurance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">Sum Insured (KES)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500 sm:text-sm"
              placeholder="e.g. 500000"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Get Quote
          </button>
        </form>
      </Card>
    </div>
  );
}