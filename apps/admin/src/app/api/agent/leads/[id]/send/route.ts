import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { sendEmail } from "@/lib/mail";
import { asRecord, loadLead } from "@/lib/growth";

/**
 * Send a drafted email to the lead.
 *
 * The whole flow is deliberately explicit: a specific `emailId`, never
 * "send the latest", so a double-click cannot fire two copies of a draft the
 * user has since scrolled past. A transport failure is written back onto the
 * row (`status: FAILED`, with the reason) and returned as 502 — the pipeline
 * then shows the failure instead of the draft silently staying blue.
 *
 * Pipeline side effects: `NEW → CONTACTED` (a reply would move it further by
 * hand), and `lastEmailedAt` so the UI can show cadence. `unverified: true`
 * is echoed back for AI-sourced leads so the UI can nudge — not block —
 * confirmation of the address.
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

  if (!lead.email) {
    return NextResponse.json(
      { error: "Add an email address to this lead before sending." },
      { status: 400 },
    );
  }

  const body = asRecord(await request.json().catch(() => null));
  const emailId = typeof body.emailId === "string" ? body.emailId : null;
  if (!emailId) {
    return NextResponse.json(
      { error: "Pick a draft to send." },
      { status: 400 },
    );
  }

  const email = lead.emails.find((e) => e.id === emailId);
  if (!email) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }
  if (email.status === "SENT") {
    return NextResponse.json(
      { error: "That draft has already been sent." },
      { status: 409 },
    );
  }

  let result;
  try {
    result = await sendEmail({
      to: lead.email,
      subject: email.subject,
      text: email.body,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The transport rejected the send.";
    await prisma.outreachEmail.update({
      where: { id: email.id },
      data: { status: "FAILED", error: message },
    });
    return NextResponse.json({ error: `Send failed: ${message}` }, { status: 502 });
  }

  const sent = await prisma.outreachEmail.update({
    where: { id: email.id },
    data: {
      status: "SENT",
      provider: result.provider,
      messageId: result.messageId,
      error: null,
      sentAt: new Date(),
    },
  });

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      // Only the first outreach flips the stage; a lead already in REPLIED or
      // beyond must not be dragged back to CONTACTED by a follow-up.
      status: lead.status === "NEW" ? "CONTACTED" : lead.status,
      lastEmailedAt: new Date(),
    },
  });

  return NextResponse.json({
    data: { email: sent, lead: updatedLead },
    simulated: result.simulated,
    unverified: !lead.verified,
  });
}
