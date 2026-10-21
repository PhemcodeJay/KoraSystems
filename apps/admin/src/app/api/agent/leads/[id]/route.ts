import { NextResponse } from "next/server";
import { withAuth, requireScope } from "@kora/auth";
import { prisma } from "@kora/database";
import { isEmail } from "@/lib/mail";
import { asRecord, cleanString, loadLead } from "@/lib/growth";

const ALLOWED_STATUS = new Set([
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "CONVERTED",
  "LOST",
]);

/**
 * Edit one lead, or remove it.
 *
 * PATCH only touches keys actually present in the body, so a form that
 * submits three fields cannot silently blank the other seven. An empty
 * string clears a nullable column (that is how "remove the phone number"
 * is expressed), and `status` is whitelisted rather than passed through —
 * Prisma would reject an unknown enum anyway, but with a 500 instead of a 400.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const loaded = await loadLead(params.id, scope);
  if (loaded.error) return loaded.error;

  const body = asRecord(await request.json().catch(() => null));
  const data: Record<string, unknown> = {};

  if ("company" in body) {
    const company = cleanString(body.company, 160);
    if (!company) {
      return NextResponse.json(
        { error: "A company name is required." },
        { status: 400 },
      );
    }
    data.company = company;
  }

  if ("email" in body) {
    const email = cleanString(body.email, 200);
    if (email && !isEmail(email)) {
      return NextResponse.json(
        { error: "That email address doesn't look right." },
        { status: 400 },
      );
    }
    data.email = email ? email.toLowerCase() : null;
  }

  if ("status" in body) {
    const status = String(body.status ?? "").toUpperCase();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: "Unknown pipeline status." }, { status: 400 });
    }
    data.status = status;
  }

  if ("verified" in body) data.verified = Boolean(body.verified);

  for (const [key, max] of [
    ["contactName", 120],
    ["role", 120],
    ["phone", 60],
    ["city", 120],
    ["notes", 1000],
  ] as const) {
    if (key in body) data[key] = cleanString(body[key], max);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update." },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.update({ where: { id: loaded.lead!.id }, data });
  return NextResponse.json({ data: lead });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  const scope = await requireScope("SME");

  const loaded = await loadLead(params.id, scope);
  if (loaded.error) return loaded.error;

  // Cascade removes the lead's outreach emails with it — an audit of mail
  // to a contact who no longer exists at all would be misleading.
  await prisma.lead.delete({ where: { id: loaded.lead!.id } });
  return NextResponse.json({ data: { id: params.id } });
}
