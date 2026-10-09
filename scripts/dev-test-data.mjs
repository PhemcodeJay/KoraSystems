/**
 * Remove test data created while verifying the platform, without touching the
 * seeded demo dataset.
 *
 * Everything here was created by hand during verification sessions:
 *   - loans          : applied via /api/loans/apply (or approved there)
 *   - savings        : account KSV-7001 and its movements
 *   - tills          : the sme_id column was added and rows inserted to test
 *                      tenant isolation
 *
 * Seeded data (users, SMEs, suppliers, customers, products, sales, the 365-day
 * history) is left intact.
 *
 * Run:  node scripts/dev-test-data.mjs            (lists what would be removed)
 *       node scripts/dev-test-data.mjs --apply    (removes it)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

// The savings account this script created by hand.
const TEST_ACCOUNT = "KSV-7001";

async function main() {
  // --- Loans -------------------------------------------------------------
  // Seeded loans are LN-2026-#### ; applied ones are LN-<base36 timestamp>.
  const loans = await prisma.loan.findMany({
    select: { id: true, loanNumber: true, principal: true, status: true, smeId: true },
  });
  const testLoans = loans.filter((l) => !/^LN-2026-/.test(l.loanNumber));

  // --- Savings -----------------------------------------------------------
  const savings = await prisma.savings.findMany({
    where: { accountNumber: TEST_ACCOUNT },
    select: { id: true, accountNumber: true, balance: true, smeId: true },
  });

  // --- Tills -------------------------------------------------------------
  // Any till is test data: the seeded dataset has none.
  const tills = await prisma.till.findMany({
    select: { id: true, name: true, smeId: true, currentBalance: true },
  });

  console.log("\nTest data found:\n");
  console.log(`  loans   (${testLoans.length})`);
  for (const l of testLoans) {
    console.log(`    - ${l.loanNumber}  KES ${l.principal}  ${l.status}`);
  }
  console.log(`  savings (${savings.length})`);
  for (const s of savings) {
    console.log(`    - ${s.accountNumber}  balance KES ${s.balance}`);
  }
  console.log(`  tills   (${tills.length})`);
  for (const t of tills) {
    console.log(`    - #${t.id} ${t.name}  balance KES ${t.currentBalance}`);
  }

  if (testLoans.length + savings.length + tills.length === 0) {
    console.log("\nNothing to clean — database already holds only seeded data.\n");
    return;
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to remove the above.\n");
    return;
  }

  // Savings first: SavingsTransaction rows cascade from the account.
  for (const s of savings) {
    await prisma.savingsTransaction.deleteMany({ where: { savingsId: s.id } });
    await prisma.savings.delete({ where: { id: s.id } });
    console.log(`  deleted savings ${s.accountNumber}`);
  }

  for (const l of testLoans) {
    // Repayments and ledger postings cascade from the loan.
    await prisma.repayment.deleteMany({ where: { loanId: l.id } });
    await prisma.loan.delete({ where: { id: l.id } });
    console.log(`  deleted loan ${l.loanNumber}`);
  }

  for (const t of tills) {
    await prisma.till.delete({ where: { id: t.id } });
    console.log(`  deleted till #${t.id} ${t.name}`);
  }

  console.log("\nDone. Seeded demo data untouched.\n");
}

main()
  .catch((e) => {
    console.error("Failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
