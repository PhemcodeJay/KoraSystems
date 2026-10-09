export type DisbursementRequest = {
  loanId: string;
  smeId: string;
  amount: number;
  /** M-Pesa phone number of the SME receiving funds, when known. */
  destinationPhone?: string | null;
  reference: string;
};

export type DisbursementResult =
  | {
      ok: true;
      /** True when no real money moved and a simulated ledger entry was written. */
      simulated: boolean;
      status: "DISBURSED" | "BLOCKED_NO_PARTNER";
      reference: string;
      reason?: string;
    }
  | {
      ok: false;
      status: "BLOCKED_NO_PARTNER" | "FAILED";
      reason: string;
    };

/**
 * Implementations must never move real funds unless a licensed partner is
 * configured. `PartnerProvider` is reserved for that integration and is
 * intentionally not implemented in Milestone 1.
 */
export interface DisbursementProvider {
  readonly name: string;
  /** False means real money movement is unavailable in this environment. */
  readonly canDisburse: boolean;
  disburse(req: DisbursementRequest): Promise<DisbursementResult>;
}
