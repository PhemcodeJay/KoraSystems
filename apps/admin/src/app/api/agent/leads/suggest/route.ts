import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { AiUnavailableError, suggestLeads } from "@kora/ai";
import {
  asRecord,
  cleanString,
  leadWhere,
  paidFeatureGate,
  resolveSender,
} from "@/lib/growth";

/**
 * AI lead sourcing — the "agent finds prospects" half of the feature.
 *
 * Paid tiers only (model calls cost money), and every row it creates lands
 * as `source: AI_SUGGESTED, verified: false` with the model's rationale in
 * `notes`: company names are plausible reconstructions and emails are
 * guesses derived from them, so the UI treats them as unverified until a
 * human confirms them. Duplicates against the existing pipeline (by company
 * or email) are skipped rather than re-sourced on every run.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const gate = paidFeatureGate(scope);
  if (gate) return gate;

  const body = asRecord(await request.json().catch(() => null));
  const niche = cleanString(body.niche, 400);
  if (!niche) {
    return NextResponse.json(
      { error: "Describe the niche you want to source (e.g. \"pharmacies in Nairobi\")." },
      { status: 400 },
    );
  }
  const location = cleanString(body.location, 160);
  const count = Number(body.count ?? 5);

  const sender = await resolveSender(scope);

  let suggestions;
  try {
    suggestions = await suggestLeads({
      niche,
      location: location ?? undefined,
      count: Number.isFinite(count) ? count : 5,
      business: sender.business,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  // Dedupe against what the pipeline already holds.
  const existing = await prisma.lead.findMany({
    where: leadWhere(scope),
    select: { company: true, email: true },
  });
  const seenCompanies = new Set(existing.map((l) => l.company.toLowerCase()));
  const seenEmails = new Set(
    existing.map((l) => l.email).filter((e): e is string => Boolean(e)),
  );

  const created = [];
  let skipped = 0;
  for (const s of suggestions) {
    const email = s.email ? s.email.toLowerCase() : null;
    if (
      seenCompanies.has(s.company.toLowerCase()) ||
      (email && seenEmails.has(email))
    ) {
      skipped += 1;
      continue;
    }
    const lead = await prisma.lead.create({
      data: {
        ownerUserId: scope.user.id,
        smeId: scope.smeId ?? null,
        company: s.company,
        contactName: s.contactName ?? null,
        role: s.role ?? null,
        email,
        city: s.city ?? null,
        source: "AI_SUGGESTED",
        verified: false,
        notes: s.why ? `AI sourcing: ${s.why}` : null,
      },
    });
    created.push(lead);
    // Belt and braces: never source the same row twice in one response.
    seenCompanies.add(s.company.toLowerCase());
    if (email) seenEmails.add(email);
  }

  return NextResponse.json({ data: created, skipped }, { status: 201 });
}
