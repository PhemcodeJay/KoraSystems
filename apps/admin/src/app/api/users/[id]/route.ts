import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Admin operations on a single account.
 *
 * Split into explicit routes rather than one handler switching on method,
 * because the permissions differ per verb: viewing an account is read access,
 * but resetting a password, changing a role or reactivating a suspended user
 * are all things that must be deliberate.
 *
 * The `select` in `GET` is exhaustive and omits `passwordHash` — the salted
 * scrypt digest is a password-equivalent secret and must never be returned,
 * not even to an admin.
 */
type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roleAssignments: {
        orderBy: { grantedAt: "desc" },
        select: {
          id: true,
          role: true,
          grantedVia: true,
          reason: true,
          grantedAt: true,
          revokedAt: true,
        },
      },
      plan: true,
      // Billing history. Admin-only by definition, and the reason it exists:
      // "why does this account have Neobank" has to be answerable.
      subscriptionEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          fromTier: true,
          toTier: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
        },
      },
      sme: { select: { id: true, businessName: true, county: true, town: true } },
      supplier: { select: { id: true, companyName: true, county: true } },
      customer: { select: { id: true, fullName: true, loyaltyTier: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "No such user." }, { status: 404 });
  return NextResponse.json({ user });
}

/**
 * Update an account's editable details.
 *
 * `role` is deliberately NOT settable here. The primary role is the anchor of
 * a user's identity — their nav, their default landing page and the ownership
 * of their existing data all key off it. Secondary roles are granted by
 * subscription tier, so neither can be set by a plain profile edit; changing
 * either is `PATCH /api/users/[id]/role`, which is auditable.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    fullName?: string;
    phone?: string | null;
    isActive?: boolean;
  } | null;

  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.fullName !== undefined) {
    const name = body.fullName.trim();
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters." },
        { status: 400 },
      );
    }
    data.fullName = name;
  }

  if (body.phone !== undefined) {
    const phone = body.phone?.trim() || null;
    if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid phone number, e.g. +254712345678." },
        { status: 400 },
      );
    }
    // phone is @unique. Checked here for a clean 409 rather than letting the
    // write throw P2002, which would surface as a 500.
    if (phone) {
      const clash = await prisma.user.findFirst({
        where: { phone, NOT: { id: params.id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: "That phone number is already on another account." },
          { status: 409 },
        );
      }
    }
    data.phone = phone;
  }

  if (body.isActive !== undefined) {
    // Guard against an admin locking themselves out — and, more importantly,
    // against the last remaining active admin being deactivated, which would
    // leave nobody able to reverse it.
    if (!body.isActive && params.id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }
    if (!body.isActive) {
      const remaining = await prisma.user.count({
        where: { role: "ADMIN", isActive: true, NOT: { id: params.id } },
      });
      if (remaining === 0) {
        return NextResponse.json(
          { error: "At least one active platform admin must remain." },
          { status: 400 },
        );
      }
    }
    data.isActive = body.isActive;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true },
    });
    return NextResponse.json({ user });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "No such user." }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not update the user." }, { status: 500 });
  }
}
