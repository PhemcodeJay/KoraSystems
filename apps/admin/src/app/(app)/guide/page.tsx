import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import { APPS, BRAND } from "@kora/brand";
import { resolveEntitlements, assertTier, assertStatus } from "@kora/auth/entitlements";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform Guide" };

const GUIDES: Record<string, { title: string; sections: { heading: string; body: string; link?: string }[] }> = {
  SME: {
    title: "SME Platform Guide",
    sections: [
      { heading: "Dashboard", body: "Your central hub for business overview, quick stats, and recent activity. View sales summaries, pending orders, and key metrics at a glance.", link: "/home" },
      { heading: "Sales", body: "Track all sales transactions, view revenue trends, and analyze customer purchasing patterns. Use the Sales Pilot for advanced forecasting.", link: "/sme/sales" },
      { heading: "Inventory", body: "Manage your product catalog, track stock levels, set reorder points, and adjust inventory. Add products with prices, SKUs, and descriptions.", link: "/sme/inventory" },
      { heading: "Customers", body: "View and manage customer records, track purchase history, and build customer relationships. Add new customers with contact details.", link: "/sme/customers" },
      { heading: "Suppliers", body: "Manage supplier relationships, view supplier orders, and track deliveries. Add suppliers with contact information and product catalogs.", link: "/sme/suppliers" },
      { heading: "Loans", body: "Apply for business loans, view loan status, track repayments, and manage loan applications. Check eligibility and interest rates.", link: "/sme/loans" },
      { heading: "Savings", body: "View savings accounts, deposit funds, withdraw, and track interest earnings. Set savings goals and monitor progress.", link: "/sme/savings" },
      { heading: "POS (SwiftPOS)", body: "Run the point of sale terminal, process payments, manage tills, print receipts, and track stock in real-time.", link: "/pos" },
      { heading: "Neobank", body: "Access business banking, virtual cards, crypto trading, investments, insurance, and lending services.", link: "/neobank" },
      { heading: "Sales Pilot", body: "Advanced analytics with demand forecasting, trend analysis, and AI-powered insights for your business.", link: "/apps" },
    ],
  },
  SUPPLIER: {
    title: "Supplier Platform Guide",
    sections: [
      { heading: "Dashboard", body: "Overview of your supplier business, incoming orders, and key metrics.", link: "/home" },
      { heading: "Orders", body: "View and manage incoming orders from SMEs. Confirm, ship, and track deliveries.", link: "/supplier" },
      { heading: "Products", body: "Manage your product catalog, set prices, and update availability for SME buyers.", link: "/supplier" },
      { heading: "Neobank", body: "Access business banking, virtual cards, and financial services.", link: "/neobank" },
    ],
  },
  CUSTOMER: {
    title: "Customer Platform Guide",
    sections: [
      { heading: "Dashboard", body: "View your purchase history, account balance, and recent transactions.", link: "/home" },
      { heading: "Payments", body: "Make payments, view payment history, and manage payment methods.", link: "/customer" },
      { heading: "Neobank", body: "Access personal banking, savings, and financial services.", link: "/neobank" },
    ],
  },
  ADMIN: {
    title: "Admin Platform Guide",
    sections: [
      { heading: "Dashboard", body: "Platform overview with system-wide metrics, user counts, and revenue summaries.", link: "/home" },
      { heading: "SMEs", body: "Manage SME tenants, view onboarding status, subscription details, and business information.", link: "/admin/smes" },
      { heading: "Plans", body: "Manage subscription plans, pricing tiers, and feature entitlements.", link: "/admin/plans" },
      { heading: "Users", body: "Manage platform users, roles, and permissions.", link: "/admin/users" },
      { heading: "Neobank", body: "Full access to all banking features for administration.", link: "/neobank" },
    ],
  },
};

export default async function GuidePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Check subscription status
  const isStaff = user.role === "ADMIN";
  const entitlements = resolveEntitlements({
    tier: isStaff ? "METAL" : assertTier(user.planTier),
    status: isStaff ? "ACTIVE" : assertStatus(user.planStatus),
  });

  const guide = GUIDES[user.role] || GUIDES.SME;

  // Filter sections based on subscription access
  const accessibleSections = guide.sections.filter((section) => {
    // Admin and staff always have access
    if (isStaff) return true;
    // Check if the section's app is unlocked
    if (section.link?.includes("/neobank") && !entitlements.apps.includes("neobank")) return false;
    if (section.link?.includes("/pos") && !entitlements.apps.includes("swiftpos")) return false;
    if (section.link?.includes("/sme/sales") && !entitlements.apps.includes("salespilot")) return false;
    if (section.link?.includes("/apps") && !entitlements.apps.includes("salespilot")) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{guide.title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Learn how to use each feature of the Kora platform. Click any link to navigate directly.
        </p>
        {!isStaff && !entitlements.active && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              Your subscription is not active. Some features may be locked.
            </p>
            <a href="/plans" className="mt-1 inline-block text-sm text-amber-700 underline">
              View plans →
            </a>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {accessibleSections.map((section) => (
          <div
            key={section.heading}
            className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-ink-900">{section.heading}</h2>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">{section.body}</p>
            {section.link && (
              <a
                href={section.link}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Open {section.heading} →
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Locked features section */}
      {!isStaff && entitlements.locked.length > 0 && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
          <h2 className="text-lg font-semibold text-ink-900">🔒 Locked Features</h2>
          <p className="mt-2 text-sm text-ink-600">
            The following features require a higher subscription tier:
          </p>
          <ul className="mt-3 space-y-2">
            {entitlements.locked.map((app) => {
              const required = entitlements.requiredTierFor(app);
              return (
                <li key={app} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{app}</span>
                  <a href="/plans" className="text-brand-600 hover:underline">
                    Requires {required?.name} plan →
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
        <h2 className="text-lg font-semibold text-ink-900">📱 WhatsApp Notifications</h2>
        <p className="mt-2 text-sm text-ink-600">
          You can receive platform guides and updates via WhatsApp. Enter your phone number below to get started.
        </p>
        <form className="mt-4 flex gap-2" action="/api/notifications/whatsapp" method="POST">
          <input
            type="tel"
            name="phone"
            placeholder="+2547XXXXXXXX"
            className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            required
          />
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Send Guide via WhatsApp
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-400">
          You&apos;ll receive a WhatsApp message with direct links to all platform features.
        </p>
      </div>

      <div className="text-xs text-ink-400 text-center">
        {BRAND.legalEntity} · {BRAND.tagline}
      </div>
    </div>
  );
}