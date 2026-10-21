import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { draftBatch, scoreLeads } from "@kora/ai";
import { leadWhere, paidFeatureGate, resolveSender } from "@/lib/growth";

/** Batch caps: one run stays one fast, cheap, predictable request. */
const SCORE_BATCH = 25;
const DRAFT_BATCH = 5;
/** Leads at or above this fit get a draft queued for them. */
const DRAFT_SCORE_FLOOR = 60;

/**
 * One agent run: score the unscored, then draft for the best of them.
 *
 * Deliberately two model calls for the whole run (both functions batch), not
 * one per lead — 25 individual calls would be slow enough to feel broken and
 * expensive enough to notice. Everything it touches is already scoped to the
 * caller, it never sends anything (sending stays a per-lead human action),
 * and it only drafts for leads that are reachable (email on file), still in
 * play, and have no open draft yet.
 *
 * Paid tiers only, mirroring `suggest`: the same reasoning — model calls are
 * the marginal cost of this feature.
 */
export async function POST() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const gate = paidFeatureGate(scope);
  if (gate) return gate;

  const where = leadWhere(scope);

  // 1 ─ Score everything unscored, oldest first so nothing starves.
  const unscored = await prisma.lead.findMany({
    where: { ...where, score: null },
    orderBy: { createdAt: "asc" },
    take: SCORE_BATCH,
  });

  let scoreEngine: "ai" | "heuristic" | null = null;
  if (unscored.length > 0) {
    const scores = await scoreLeads(unscored);
    scoreEngine = scores.some((s) => s.engine === "ai") ? "ai" : "heuristic";
    await prisma.$transaction(
      unscored.map((lead, i) =>
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            score: scores[i].score,
            scoreReason: `[${scores[i].engine}] ${scores[i].reason}`,
          },
        }),
      ),
    );
  }

  // 2 ─ Draft for the strongest reachable leads with no open draft.
  const candidates = await prisma.lead.findMany({
    where: {
      ...where,
      email: { not: null },
      score: { gte: DRAFT_SCORE_FLOOR },
      status: { in: ["NEW", "CONTACTED"] },
      emails: { none: { status: { in: ["DRAFT", "SENT"] } } },
    },
    include: { emails: true },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: DRAFT_BATCH,
  });

  let draftEngine: "ai" | "template" | null = null;
  if (candidates.length > 0) {
    const sender = await resolveSender(scope);
    const drafts = await draftBatch(
      candidates.map((lead) => ({ lead, sender })),
    );
    draftEngine = drafts.some((d) => d.engine === "ai") ? "ai" : "template";
    await prisma.$transaction(
      candidates.map((lead, i) =>
        prisma.outreachEmail.create({
          data: {
            leadId: lead.id,
            subject: drafts[i].subject,
            body: drafts[i].body,
            status: "DRAFT",
          },
        }),
      ),
    );
  }

  return NextResponse.json({
    data: {
      scored: unscored.length,
      drafted: candidates.length,
      scoreEngine,
      draftEngine,
    },
  });
}
