import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { hashPassword, validatePasswordStrength } from "@kora/auth/password";
import { NextResponse } from "next/server";

/**
 * Reset another account's password.
 *
 * The plaintext is accepted here, hashed immediately, and never stored, logged
 * or returned. The response contains no part of the new password — an admin
 * who resets a password should hand it over through a channel they trust, and
 * nothing this endpoint emits should be treated as a record of it.
 *
 * `mustChangePassword` is set, so the account cannot keep using the
 * admin-chosen value indefinitely. The hash goes through the same salted scrypt
 * path as a self-service sign-up: one implementation, one set of parameters.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!body?.password) {
    return NextResponse.json({ error: "A new password is required." }, { status: 400 });
  }

  const weak = validatePasswordStrength(body.password);
  if (weak) return NextResponse.json({ error: weak, status: 400 });

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, isActive: true },
  });
  if (!target) return NextResponse.json({ error: "No such user." }, { status: 404 });

  if (!target.isActive) {
    return NextResponse.json(
      { error: "That account is deactivated. Reactivate it before resetting its password." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(body.password);

  await prisma.user.update({
    where: { id: target.id },
    // mustChangePassword forces a rotation at next sign-in, so the reset value
    // is a bridge rather than a permanent credential.
    data: { passwordHash, mustChangePassword: true },
  });

  return NextResponse.json({
    ok: true,
    userId: target.id,
    email: target.email,
    mustChangePassword: true,
  });
}
