export const ACCOUNTS = {
  PLATFORM_FLOAT: "PLATFORM_FLOAT",
  SME_WALLET: "SME_WALLET",
  SUPPLIER_PAYABLE: "SUPPLIER_PAYABLE",
  LOAN_PRINCIPAL: "LOAN_PRINCIPAL",
  LOAN_RECEIVABLE: "LOAN_RECEIVABLE",
  SAVINGS: "SAVINGS",
  BNPL_RECEIVABLE: "BNPL_RECEIVABLE",
  REVENUE: "REVENUE",
  CUSTOMER_WALLET: "CUSTOMER_WALLET",
  PLATFORM_REVENUE: "PLATFORM_REVENUE",
} as const;

export type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

export const DIRECTION = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;

export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

/** A single leg of a double-entry posting. */
export type LedgerLeg = {
  accountCode: AccountCode;
  direction: Direction;
  amount: number;
  narration?: string;
};

export type PostingInput = {
  reference: string;
  type: string;
  description?: string;
  accountCode: AccountCode;
  amount: number;
  smeId?: string | null;
  customerId?: string | null;
  simulated?: boolean;
  metadata?: Record<string, unknown>;
  loanId?: string | null;
  repaymentId?: string | null;
  bnplInstallmentId?: string | null;
  postedAt?: Date;
};

export class UnbalancedPostingError extends Error {
  constructor(
    public readonly reference: string,
    public readonly debits: number,
    public readonly credits: number,
  ) {
    super(
      `Unbalanced posting for "${reference}": debits ${debits.toFixed(2)} != credits ${credits.toFixed(2)}`,
    );
    this.name = "UnbalancedPostingError";
  }
}
