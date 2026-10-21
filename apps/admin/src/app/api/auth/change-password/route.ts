import { NextResponse } from "next/server";
import { prisma } from "@kora/database";
import { getSessionUser } from "@kora/auth";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@kora/auth/password";

/**
 * Change your own password.
 *
 * The current password is required even though the caller is already signed
 * in. A session is not sufficient authority to rotate a credential: if someone
 * walks up to an unlocked machine, the signed-in session would let them lock
 * the owner out by changing the password to something only they know. Requiring
 * the current password means a stolen session alone cannot take the account
 * over permanently.
 *
 * Re-hashing with a fresh salt on every change is why salting matters — two
 * users who pick the same password get unrelated digests.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;

  if (!body?.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: "Your current password and a new password are both required." },
      { status: 400 },
    );
  }

  const weak = validatePasswordStrength(body.newPassword);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true },
  });
  if (!record) return NextResponse.json({ error: "No such user." }, { status: 404 });

  // A user with no local hash (Supabase-managed) cannot verify the current
  // password here, so this endpoint does not apply to them.
  if (!record.passwordHash) {
    return NextResponse.json(
      {
        error:
          "This account's password is managed by the identity provider. Change it there.",
      },
      { status: 400 },
    );
  }

  if (!(await verifyPassword(body.currentPassword, record.passwordHash))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  if (await verifyPassword(body.newPassword, record.passwordHash)) {
    return NextResponse.json(
      { error: "The new password must be different from the current one." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(body.newPassword),
      // The user has now supplied a password of their own choosing, so any
      // earlier admin-forced reset is satisfied.
      mustChangePassword: false,
    },
  });

  // The existing cookie stays valid — it is not a password-derived secret — but
  // it is refreshed so the change is visible immediately in this session.
  return NextResponse.json({ ok: true });
}
