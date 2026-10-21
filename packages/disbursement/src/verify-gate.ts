/**
 * Verifies the disbursement gate behaves as designed:
 *  - DISBURSEMENT_PROVIDER defaults to "simulated" when unset/mistyped
 *  - an approval does NOT move funds; the loan parks at BLOCKED_NO_PARTNER
 *  - the simulated ledger entry is balanced and flagged
 *
 * Run with: pnpm --filter @kora/disbursement test:gate
 */
import { prisma } from "@kora/database";
import { findUnbalanced } from "@kora/ledger";
import { getDisbursementProvider } from "./index";

async function main() {
  let failures = 0;
  const check = (label: string, pass: boolean, detail = "") => {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` - ${detail}` : ""}`);
    if (!pass) failures++;
  };

  console.log("Disbursement gate verification\n");

  // 1. Provider resolution must fail safe.
  const prev = process.env.DISBURSEMENT_PROVIDER;
  delete process.env.DISBURSEMENT_PROVIDER;
  check(
    "unset DISBURSEMENT_PROVIDER resolves to simulated",
    getDisbursementProvider().name === "simulated",
  );
  process.env.DISBURSEMENT_PROVIDER = "partner-typo";
  check(
    "mistyped provider falls back to simulated",
    getDisbursementProvider().name === "simulated",
  );
  process.env.DISBURSEMENT_PROVIDER = "partner";
  check(
    "explicit partner resolves to partner",
    getDisbursementProvider().name === "partner",
  );
  check(
    "partner provider cannot disburse yet",
    getDisbursementProvider().canDisburse === false,
  );
  if (prev) process.env.DISBURSEMENT_PROVIDER = prev;
  else delete process.env.DISBURSEMENT_PROVIDER;

  // 2. Approve a queued loan and confirm no funds move.
  const queued = await prisma.loan.findFirst({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
  });

  if (!queued) {
    console.log("  SKIP  no PENDING_REVIEW loan to exercise the gate");
  } else {
    const provider = getDisbursementProvider();
    // Unique per run: Transaction.reference is unique, so a fixed value
    // would fail on any repeat invocation.
    const runId = `GATETEST-${Date.now().toString(36)}`;
    const result = await provider.disburse({
      loanId: queued.id,
      smeId: queued.smeId,
      amount: Number(queued.principal),
      destinationPhone: null,
      reference: `${runId}-${queued.loanNumber}`,
    });

    check("disbursement returns ok", result.ok);
    check("status is BLOCKED_NO_PARTNER", result.status === "BLOCKED_NO_PARTNER");
    check("result is flagged simulated", "simulated" in result && result.simulated === true);

    const after = await prisma.loan.findUniqueOrThrow({ where: { id: queued.id } });
    check("loan parked at BLOCKED_NO_PARTNER", after.status === "BLOCKED_NO_PARTNER");
    check("no disbursement timestamp recorded", after.disbursedAt === null);
    check("blocked reason recorded", !!after.blockedReason, after.blockedReason?.slice(0, 40));

    const posting = await prisma.transaction.findFirst({
      where: { reference: `DISB-${runId}-${queued.loanNumber}` },
      include: { entries: true },
    });
    check("ledger posting created", !!posting);
    check("posting flagged simulated", posting?.simulated === true);
    if (posting) {
      const dr = posting.entries
        .filter((e) => e.direction === "DEBIT")
        .reduce((s, e) => s + Number(e.amount), 0);
      const cr = posting.entries
        .filter((e) => e.direction === "CREDIT")
        .reduce((s, e) => s + Number(e.amount), 0);
      check("posting is balanced", Math.abs(dr - cr) < 0.01, `Dr ${dr} / Cr ${cr}`);
    }
  }

  // 3. Whole-ledger integrity.
  const unbalanced = await findUnbalanced(prisma, 200);
  check("no unbalanced transactions in the ledger", unbalanced.length === 0, `${unbalanced.length} found`);

  console.log(`\n${failures === 0 ? "All gate checks passed." : `${failures} check(s) failed.`}`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error("GATE VERIFICATION ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
