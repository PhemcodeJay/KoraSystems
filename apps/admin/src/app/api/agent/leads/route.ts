import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { isEmail } from "@/lib/mail";
import { asRecord, cleanString, leadWhere } from "@/lib/growth";

/**
 * The lead pipeline: list it, add to it by hand.
 *
 * GET returns rows newest-first with their full email history, so the client
 * renders drafts and sent receipts without N+1 calls. POST is manual entry —
 * `source: MANUAL, verified: true`, because a human typing the address *is*
 * the verification step that AI-sourced rows lack.
 */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const leads = await prisma.lead.findMany({
    where: leadWhere(scope),
    include: { emails: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ data: leads });
}

export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const body = asRecord(await request.json().catch(() => null));

  const company = cleanString(body.company, 160);
  if (!company) {
    return NextResponse.json(
      { error: "A company name is required." },
      { status: 400 },
    );
  }

  const rawEmail = cleanString(body.email, 200);
  if (rawEmail && !isEmail(rawEmail)) {
    return NextResponse.json(
      { error: "That email address doesn't look right." },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.create({
    data: {
      ownerUserId: scope.user.id,
      smeId: scope.smeId ?? null,
      company,
      contactName: cleanString(body.contactName, 120),
      role: cleanString(body.role, 120),
      email: rawEmail ? rawEmail.toLowerCase() : null,
      phone: cleanString(body.phone, 60),
      city: cleanString(body.city, 120),
      notes: cleanString(body.notes, 1000),
      source: "MANUAL",
      // Typed by a human, so it is trusted contact data from the start.
      verified: true,
    },
  });

  return NextResponse.json({ data: lead }, { status: 201 });
}
