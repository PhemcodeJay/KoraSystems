import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEAT_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

async function tenantId(): Promise<string | null> {
  const { requireScope } = await import("@kora/auth/guards");
  const scope = await requireScope("SME", "ADMIN");
  return scope.smeId ?? null;
}

/** Team seats with usage vs the tier cap. */
export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;
  try {
    const smeId = await tenantId();
    if (!smeId) {
      return NextResponse.json({ error: "No business is linked." }, { status: 403 });
    }
    const { getTenantSubscription } = await import("@kora/auth/tenant-billing");
    const [sub, members] = await Promise.all([
      getTenantSubscription(prisma, smeId),
      prisma.smeMember.findMany({
        where: { smeId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, email: true, role: true, isActive: true, joinedAt: true,
          user: { select: { fullName: true } },
        },
      }),
    ]);
    return NextResponse.json({
      data: { members, seatsUsed: sub.seatsUsed, seatsLimit: sub.seatsLimit, tier: sub.tier },
    });
  } catch {
    return NextResponse.json({ error: "Team is unavailable." }, { status: 503 });
  }
}



/** Invite a seat by email. Owner/manager only; tier seat cap → 402. */
export async function POST(request: Request) {
  const auth = await withAuth("SME");
  if (auth.response) return auth.response;
  try {
    const smeId = await tenantId();
    if (!smeId) {
      return NextResponse.json({ error: "No business is linked." }, { status: 403 });
    }
    const { getTenantSubscription } = await import("@kora/auth/tenant-billing");
    const { limitExceeded } = await import("@kora/auth/tenant-usage");
    const [sub, sme, me] = await Promise.all([
      getTenantSubscription(prisma, smeId),
      prisma.sME.findUnique({ where: { id: smeId }, select: { userId: true } }),
      prisma.smeMember.findFirst({
        where: { smeId, userId: auth.user.id, isActive: true },
        select: { role: true },
      }),
    ]);
    const canInvite =
      sme?.userId === auth.user.id || me?.role === "OWNER" || me?.role === "MANAGER";
    if (!canInvite) {
      return NextResponse.json({ error: "Only owners and managers can invite." }, { status: 403 });
    }
    const check = limitExceeded(sub.tier, "seats", sub.seatsUsed);
    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, limit: check.limit, used: check.used, upgradeTo: check.upgradeTo },
        { status: 402 },
      );
    }
    const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body?.role === "string" ? body.role.toUpperCase() : "CASHIER";
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!(SEAT_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: "Role must be OWNER, MANAGER or CASHIER." }, { status: 400 });
    }
    if (role === "OWNER" && me?.role !== "OWNER" && sme?.userId !== auth.user.id) {
      return NextResponse.json({ error: "Only an owner can invite an owner." }, { status: 403 });
    }
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const member = await prisma.smeMember.upsert({
      where: { smeId_email: { smeId, email } },
      create: {
        smeId, userId: existingUser?.id ?? null, email,
        role: role as (typeof SEAT_ROLES)[number], invitedBy: auth.user.id,
      },
      update: { role: role as (typeof SEAT_ROLES)[number], isActive: true },
      select: { id: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ data: member }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not invite that email." }, { status: 503 });
  }
}

/** Remove a seat (?id=). Owner only; the owner seat itself is protected. */
export async function DELETE(request: Request) {
  const auth = await withAuth("SME");
  if (auth.response) return auth.response;
  try {
    const smeId = await tenantId();
    if (!smeId) {
      return NextResponse.json({ error: "No business is linked." }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const [target, sme, me] = await Promise.all([
      prisma.smeMember.findFirst({ where: { id, smeId } }),
      prisma.sME.findUnique({ where: { id: smeId }, select: { userId: true } }),
      prisma.smeMember.findFirst({
        where: { smeId, userId: auth.user.id, isActive: true },
        select: { role: true },
      }),
    ]);
    if (!target) return NextResponse.json({ error: "No such team member." }, { status: 404 });
    const isOwner = sme?.userId === auth.user.id || me?.role === "OWNER";
    if (!isOwner) {
      return NextResponse.json({ error: "Only the owner can remove seats." }, { status: 403 });
    }
    if (target.userId && target.userId === sme?.userId) {
      return NextResponse.json({ error: "The owner seat cannot be removed." }, { status: 400 });
    }
    await prisma.smeMember.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove that seat." }, { status: 503 });
  }
}
