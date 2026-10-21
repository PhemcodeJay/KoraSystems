import { prisma, scoreSmeCredit } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Apply for a loan.
 *
 * `smeId` comes from the session so an SME cannot apply against another
 * business. Applications always land in PENDING_REVIEW — nothing here approves
 * or disburses. Money movement stays behind the fail-closed gate in
 * @kora/disbursement, so this endpoint records intent only.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const smeId = scope.smeId;
  if (!smeId) {
    return NextResponse.json(
      { error: "No business is linked to this account." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const principal = Number(body.principal);
  const termMonths = Number(body.termMonths ?? 12);

  if (!Number.isFinite(principal) || principal <= 0) {
    return NextResponse.json(
      { error: "A principal amount greater than zero is required." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 60) {
    return NextResponse.json(
      { error: "Term must be between 1 and 60 months." },
      { status: 400 },
    );
  }

  // One open application per business at a time, so an SME cannot flood the
  // review queue by submitting repeatedly.
  const open = await prisma.loan.findFirst({
    where: {
      smeId: scope.smeId,
      status: { in: ["PENDING_REVIEW", "APPROVED", "DISBURSEMENT_PENDING"] },
    },
    select: { loanNumber: true },
  });
  if (open) {
    return NextResponse.json(
      {
        error: `You already have an application in progress (${open.loanNumber}).`,
      },
      { status: 409 },
    );
  }

  const assessment = await scoreSmeCredit(prisma, smeId);
  const interestRate = 0.12;
  const totalPayable = principal * (1 + (interestRate * termMonths) / 12);

  const { score, risk, maxLoan, factors, model, explanation, recommendations } = assessment;
  const loan = await prisma.$transaction(async (tx) => {
    const createdLoan = await tx.loan.create({
      data: {
        loanNumber: `LN-${Date.now().toString(36).toUpperCase()}`,
        smeId,
        principal,
        interestRate,
        termMonths,
        totalPayable,
        status: "PENDING_REVIEW",
        purpose: body.purpose ?? null,
        creditScoreAtApplication: score,
        // No amount is approved until a human reviewer makes that decision.
        // Marked simulated: no funds move until a licensed partner is wired up.
        simulated: true,
        blockedReason:
          process.env.DISBURSEMENT_PROVIDER === "mpesa"
            ? null
            : "No licensed disbursement partner configured",
      },
    });
    await tx.creditScore.create({
      data: {
        smeId,
        loanId: createdLoan.id,
        score,
        riskLevel: risk,
        maxLoan,
        interestRate: assessment.interestRate,
        factors: factors as never,
        model,
        explanation,
        recommendations,
        isPlaceholder: false,
      },
    });
    return createdLoan;
  });

  return NextResponse.json(
    { data: loan, creditScore: { score, risk, maxLoan, explanation, factors } },
    { status: 201 },
  );
}
