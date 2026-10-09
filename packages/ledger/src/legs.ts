import { ACCOUNTS, DIRECTION, type LedgerLeg } from "./types";
import { money } from "./post";

/**
 * Reusable balanced posting builders. Each returns legs that already balance;
 * `post()` re-asserts this before writing, so a builder bug can never produce
 * a half-written entry set.
 */

/** Customer pays SME: cash in, revenue recognised, platform fee recognised. */
export function saleLegs(amount: number, platformFee: number): LedgerLeg[] {
  const amt = money(amount);
  const fee = Math.min(money(platformFee), amt);
  const legs: LedgerLeg[] = [
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Sale receipt",
    },
    {
      accountCode: ACCOUNTS.REVENUE,
      direction: DIRECTION.CREDIT,
      amount: money(amt - fee),
      narration: "Sale revenue",
    },
  ];
  if (fee > 0) {
    legs.push({
      accountCode: ACCOUNTS.PLATFORM_REVENUE,
      direction: DIRECTION.CREDIT,
      amount: fee,
      narration: "Platform fee",
    });
  }
  return legs;
}

/** Loan disbursement out to the SME. */
export function loanDisbursementLegs(principal: number): LedgerLeg[] {
  const amt = money(principal);
  return [
    {
      accountCode: ACCOUNTS.LOAN_PRINCIPAL,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Loan disbursed",
    },
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Loan to SME",
    },
  ];
}

/** Repayment received: reduce receivable, recognise interest income. */
export function repaymentLegs(principal: number, interest: number): LedgerLeg[] {
  const p = money(principal);
  const i = money(interest);
  const legs: LedgerLeg[] = [
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.DEBIT,
      amount: money(p + i),
      narration: "Repayment received",
    },
    {
      accountCode: ACCOUNTS.LOAN_RECEIVABLE,
      direction: DIRECTION.CREDIT,
      amount: p,
      narration: "Principal recovered",
    },
  ];
  if (i > 0) {
    legs.push({
      accountCode: ACCOUNTS.PLATFORM_REVENUE,
      direction: DIRECTION.CREDIT,
      amount: i,
      narration: "Interest income",
    });
  }
  return legs;
}

/** Savings deposit. */
export function savingsDepositLegs(amount: number): LedgerLeg[] {
  const amt = money(amount);
  return [
    {
      accountCode: ACCOUNTS.SAVINGS,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Savings deposit",
    },
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Cash into savings",
    },
  ];
}

/** Savings withdrawal (reverse of deposit). */
export function savingsWithdrawalLegs(amount: number): LedgerLeg[] {
  const amt = money(amount);
  return [
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Cash out of savings",
    },
    {
      accountCode: ACCOUNTS.SAVINGS,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Savings withdrawal",
    },
  ];
}

/** BNPL plan created: receivable up, goods deferred. */
export function bnplLegs(financedAmount: number): LedgerLeg[] {
  const amt = money(financedAmount);
  return [
    {
      accountCode: ACCOUNTS.BNPL_RECEIVABLE,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "BNPL financed",
    },
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Goods on credit",
    },
  ];
}

/** BNPL installment received. */
export function bnplRepaymentLegs(amount: number): LedgerLeg[] {
  const amt = money(amount);
  return [
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "BNPL installment received",
    },
    {
      accountCode: ACCOUNTS.BNPL_RECEIVABLE,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "BNPL recovered",
    },
  ];
}

/** Payment from SME to supplier. */
export function supplierPaymentLegs(amount: number): LedgerLeg[] {
  const amt = money(amount);
  return [
    {
      accountCode: ACCOUNTS.SUPPLIER_PAYABLE,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Paid supplier",
    },
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Cash out to supplier",
    },
  ];
}

/** Platform subscription fee received from an SME. */
export function subscriptionLegs(amount: number): LedgerLeg[] {
  const amt = money(amount);
  return [
    {
      accountCode: ACCOUNTS.SME_WALLET,
      direction: DIRECTION.DEBIT,
      amount: amt,
      narration: "Subscription payment",
    },
    {
      accountCode: ACCOUNTS.PLATFORM_REVENUE,
      direction: DIRECTION.CREDIT,
      amount: amt,
      narration: "Subscription revenue",
    },
  ];
}
