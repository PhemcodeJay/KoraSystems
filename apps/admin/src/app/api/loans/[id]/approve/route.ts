import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Approve a loan application.
 *
 * Records the decision and who made it. It does NOT disburse: money movement
 * stays behind the fail-closed gate in @kora/disbursement, so approving here
 * can never move funds without a licensed partner configured.
 *
 * Only applications actually awaiting review can be approved, so a replayed
 * request cannot overwrite an earlier decision.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, smeId: true, principal: true, maxApprovedAmount: true },
  });

  if (!loan) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }
  if (loan.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: `This loan is ${loan.status} and cannot be approved.` },
      { status: 409 },
    );
  }

  // Approve no more than the credit decision allowed, when one was captured.
  const cap = loan.maxApprovedAmount ? Number(loan.maxApprovedAmount) : null;
  const principal = Number(loan.principal);
  const approved = cap !== null ? Math.min(principal, cap) : principal;

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: "APPROVED",
      maxApprovedAmount: approved,
      decisionReason: "Approved by platform admin",
      decidedAt: new Date(),
      decidedByUserId: auth.user.id,
      // Disbursement stays pending; no funds move here.
      simulated: true,
    },
  });

  return NextResponse.json({ data: updated });
}
