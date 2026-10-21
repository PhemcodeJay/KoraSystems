import { redirect } from "next/navigation";
import {
  assertStatus,
  assertTier,
  getSessionUser,
  statusGrantsAccess,
} from "@kora/auth";
import { prisma } from "@kora/database";
import { aiConfigured } from "@kora/ai";
import { GrowthAgent, type LeadDTO } from "@/components/growth/growth-agent";

export const dynamic = "force-dynamic";

/**
 * The sales-agent workspace: pipeline, sourcing, drafts and sending.
 *
 * Leads render on the server so first paint needs no client fetch, and every
 * Date is converted to an ISO string here — RSC props must be plain JSON,
 * which is also the shape the API routes return, so the client component
 * treats server and fetched leads identically.
 *
 * Role gate mirrors the nav (SME + ADMIN); ownership is applied in the query
 * itself — an ADMIN sees every lead, anyone else only their own.
 */
export default async function GrowthPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SME" && user.role !== "ADMIN") redirect("/home");

  const isAdmin = user.role === "ADMIN";

  const [profile, raw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        sme: { select: { businessName: true } },
      },
    }),
    prisma.lead.findMany({
      where: isAdmin ? {} : { ownerUserId: user.id },
      include: { emails: { orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  const leads: LeadDTO[] = raw.map((l) => ({
    id: l.id,
    company: l.company,
    contactName: l.contactName,
    role: l.role,
    email: l.email,
    phone: l.phone,
    city: l.city,
    country: l.country,
    source: l.source,
    status: l.status,
    score: l.score,
    scoreReason: l.scoreReason,
    notes: l.notes,
    verified: l.verified,
    lastEmailedAt: l.lastEmailedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    emails: l.emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      body: e.body,
      status: e.status,
      provider: e.provider,
      messageId: e.messageId,
      error: e.error,
      sentAt: e.sentAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  }));

  // Same gate the API enforces, resolved once here so the source panel can
  // render an upgrade prompt instead of a button that 403s.
  const tier = assertTier(user.planTier);
  const status = assertStatus(user.planStatus);
  const canSource =
    isAdmin || (statusGrantsAccess(status) && tier !== null && tier !== "FREE");

  const tierName =
    tier === "STANDARD" ? "Growth" : tier === "METAL" ? "Enterprise" : "Starter";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Sales agent
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Source prospects, score the pipeline, draft outreach — and send when
          you are happy with it.
        </p>
      </header>

      <GrowthAgent
        initialLeads={leads}
        canSource={canSource}
        aiReady={aiConfigured()}
        tierName={tierName}
        senderName={profile?.fullName || user.fullName}
        businessName={profile?.sme?.businessName || ""}
      />
    </div>
  );
}
