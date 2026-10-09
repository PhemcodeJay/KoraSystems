import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import {
  assertStatus,
  assertTier,
  statusGrantsAccess,
  type Scope,
} from "@kora/auth";
import type { Sender } from "@kora/ai";

/**
 * Shared plumbing for the growth (sales-agent) routes.
 *
 * ── Ownership ───────────────────────────────────────────────────────────────
 * An ADMIN reads and edits every lead; anyone else only their own
 * (`ownerUserId`). Rows also stamp `smeId` when the owner has a business, so
 * org-level sharing arrives with the multi-tenancy work rather than a data
 * migration — until then the pipeline is deliberately personal.
 *
 * ── Plan gate ───────────────────────────────────────────────────────────────
 * The model-backed bulk operations (sourcing, batch runs) are the expensive
 * ones and are reserved for paid tiers; per-lead actions and manual entry
 * stay available on every plan so the feature is usable — and discoverably
 * worth upgrading for — on FREE.
 */

/** Ownership filter for lead queries. */
export function leadWhere(scope: Scope) {
  return scope.isAdmin ? {} : { ownerUserId: scope.user.id };
}

/**
 * Load a lead plus its email history, scoped to the caller.
 *
 * Returns the same response-union shape as `withAuth`: check `.error` first,
 * then use `.lead`.
 */
export async function loadLead(id: string, scope: Scope) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { emails: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead || (!scope.isAdmin && lead.ownerUserId !== scope.user.id)) {
    return {
      error: NextResponse.json({ error: "Lead not found." }, { status: 404 }),
      lead: undefined,
    };
  }
  return { error: undefined, lead };
}

/**
 * The identity outreach emails sign with: the user's name and their business.
 *
 * ADMIN accounts usually have no SME row; falling back to their name keeps
 * the signature honest rather than inventing a business for them.
 */
export async function resolveSender(scope: Scope): Promise<Sender> {
  const profile = await prisma.user.findUnique({
    where: { id: scope.user.id },
    select: {
      fullName: true,
      sme: { select: { businessName: true } },
    },
  });
  return {
    name: profile?.fullName?.trim() || scope.user.email,
    business: profile?.sme?.businessName?.trim() || "KoraSystems",
  };
}

/**
 * 403 for model-backed bulk features on the FREE plan, or null to proceed.
 *
 * `upgrade` is a path, not a sentence, so the client can render a real link
 * to the plans page next to the error.
 */
export function paidFeatureGate(scope: Scope): NextResponse | null {
  if (scope.isAdmin) return null;
  const tier = assertTier(scope.tier);
  const status = assertStatus(scope.planStatus);
  if (statusGrantsAccess(status) && tier && tier !== "FREE") return null;
  return NextResponse.json(
    {
      error: "AI lead sourcing and batch runs are included in Growth and Enterprise plans.",
      upgrade: "/plans",
    },
    { status: 403 },
  );
}

/** Trimmed string from untrusted input, or null when empty/non-string. */
export function cleanString(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

/** Narrow a parsed JSON body to a record so field access is type-safe. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
