import { redirect } from "next/navigation";
import { getSessionUser } from "@kora/auth/guards";
import { prisma } from "@kora/database";
import { Badge, Card, Empty, Table, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

const fmtKES = (n: number | string) =>
  `KES ${Number(n ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SME" && user.role !== "ADMIN") redirect("/home");
  const smeId = user.tenantSmeId ?? null;
  if (!smeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-ink-900">Billing</h1>
        <Card><Empty message="No business is linked to this account yet." /></Card>
      </div>
    );
  }
  let sub: Record<string, string | number | Date | null> | null = null;
  let usage: Record<string, number> | null = null;
  let events: { id: string; reason: string | null; toTier: string | null; amount: number; createdAt: Date }[] = [];
  let catalogue: { tier: string; name: string; price: number; yearlyPrice: number; features: string[]; popular: boolean; seats: number; products: number }[] = [];
  let degraded = false;
  try {
    const billing = await import("@kora/auth/tenant-billing");
    const tenantUsage = await import("@kora/auth/tenant-usage");
    const ent = await import("@kora/auth/entitlements");
    const s = await billing.getTenantSubscription(prisma, smeId);
    sub = { tier: s.tier, status: s.status, cycle: s.cycle, amount: Number(s.amount), trialEndsAt: s.trialEndsAt, currentPeriodEnd: s.currentPeriodEnd };
    const u = await tenantUsage.getTenantUsage(prisma, smeId, s.tier);
    usage = { ...u };
    catalogue = ent.TIER_ORDER.map((t) => ({
      tier: ent.TIERS[t].tier, name: ent.TIERS[t].name, price: ent.TIERS[t].price,
      yearlyPrice: ent.TIERS[t].yearlyPrice, features: [...ent.TIERS[t].features],
      popular: !!ent.TIERS[t].popular, seats: ent.TIERS[t].limits.seats, products: ent.TIERS[t].limits.products,
    }));
    events = await prisma.smeBillingEvent.findMany({
      where: { smeId }, orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, reason: true, toTier: true, amount: true, createdAt: true },
    }).then((rows) => rows.map((r) => ({ ...r, amount: Number(r.amount) })));
  } catch { degraded = true; }
  const trialDaysLeft =
    sub?.trialEndsAt != null
      ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt as Date).getTime() - Date.now()) / 86400000))
      : null;
  const cap = (used: number, limit: number) =>
    limit < 0 ? `${used} / unlimited` : `${used} / ${limit}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Billing</h1>
        <p className="mt-0.5 text-sm text-ink-500">One plan per business — seats, products, sales and tills count against it.</p>
      </div>
      {degraded && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Billing details are unavailable right now. Your current plan still applies.
        </p>
      )}

      {sub && (
        <Card title="Current plan" hint={`${sub.tier} · ${String(sub.status).toLowerCase()}`}>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Amount</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
                {Number(sub.amount) === 0 ? "Free" : fmtKES(Number(sub.amount))}
              </p>
              <p className="text-xs text-ink-500">{String(sub.cycle).toLowerCase()} billing</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Status</p>
              <div className="mt-1"><Badge>{String(sub.status)}</Badge></div>
              {trialDaysLeft != null && sub.status === "TRIALING" && (
                <p className="mt-1 text-xs text-ink-500">{trialDaysLeft} trial days left</p>
              )}
            </div>
          </div>
        </Card>
      )}
      {usage && (
        <Card title="Usage" hint="Sales reset monthly; seats, products and tills are totals">
          <Table>
            <thead className="bg-ink-50">
              <tr><Th>Resource</Th><Th className="text-right">Used</Th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              <tr><Td>Staff seats</Td><Td className="text-right tabular-nums">{cap(usage.seatsUsed, usage.seatsLimit)}</Td></tr>
              <tr><Td>Products</Td><Td className="text-right tabular-nums">{cap(usage.productsUsed, usage.productsLimit)}</Td></tr>
              <tr><Td>Sales this month</Td><Td className="text-right tabular-nums">{cap(usage.salesThisMonth, usage.salesLimit)}</Td></tr>
              <tr><Td>Tills</Td><Td className="text-right tabular-nums">{cap(usage.tillsUsed, usage.tillsLimit)}</Td></tr>
            </tbody>
          </Table>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {catalogue.map((t) => (
          <Card
            key={t.tier}
            className={sub?.tier === t.tier ? "ring-2 ring-brand-500" : ""}
            title={t.name}
            hint={t.price === 0 ? "Free" : `${fmtKES(t.price)} / mo · ${fmtKES(t.yearlyPrice)} / yr`}
          >
            {t.popular && <Badge className="mb-2 bg-brand-50 text-brand-800 ring-brand-500/30">Most popular</Badge>}
            <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
              {t.features.map((f) => <li key={f}>&middot; {f}</li>)}
            </ul>
            <p className="mt-3 text-xs text-ink-500">
              {t.seats < 0 ? "Unlimited" : t.seats} seats · {t.products < 0 ? "unlimited" : t.products} products
            </p>
          </Card>
        ))}
      </div>
      {events.length > 0 && (
        <Card title="Billing history">
          <Table>
            <thead className="bg-ink-50">
              <tr><Th>When</Th><Th>Change</Th><Th className="text-right">Amount</Th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {events.map((e) => (
                <tr key={e.id}>
                  <Td className="text-xs">{fmtDate(e.createdAt)}</Td>
                  <Td className="text-sm">{e.reason ?? e.toTier ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{fmtKES(e.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
