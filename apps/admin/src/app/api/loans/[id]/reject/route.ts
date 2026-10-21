import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Reject a loan application, recording the reason for the audit trail.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }
  if (loan.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: `This loan is ${loan.status} and cannot be rejected.` },
      { status: 409 },
    );
  }

  let reason = "Rejected by platform admin";
  try {
    const body = await request.json();
    if (typeof body?.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim();
    }
  } catch {
    // No body sent — keep the default reason.
  }

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: "REJECTED",
      decisionReason: reason,
      decidedAt: new Date(),
      decidedByUserId: auth.user.id,
    },
  });

  return NextResponse.json({ data: updated });
}
