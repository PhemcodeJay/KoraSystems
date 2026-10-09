import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { draftOutreach } from "@kora/ai";
import { asRecord, cleanString, loadLead, resolveSender } from "@/lib/growth";

/**
 * Draft an outreach email for one lead and store it as a DRAFT.
 *
 * Drafting never sends — the preview-then-send split in the UI is the human
 * checkpoint on AI-written copy. A lead may be drafted without an email
 * address on file (so copy can be reviewed early); the send route is what
 * insists on one. Each call appends a new draft rather than overwriting, so
 * an edited angle can be compared against the previous version.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const loaded = await loadLead(params.id, scope);
  if (loaded.error) return loaded.error;
  const lead = loaded.lead!;

  const body = asRecord(await request.json().catch(() => null));
  const goal = cleanString(body.goal, 400);

  const sender = await resolveSender(scope);
  const draft = await draftOutreach({ lead, sender, goal: goal ?? undefined });

  const email = await prisma.outreachEmail.create({
    data: {
      leadId: lead.id,
      subject: draft.subject,
      body: draft.body,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ data: email, engine: draft.engine }, { status: 201 });
}
