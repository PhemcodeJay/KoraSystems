import { MpesaProvider, PartnerProvider, SimulatedProvider } from "./providers";
import type { DisbursementProvider } from "./types";

export * from "./types";
export { MpesaProvider, SimulatedProvider, PartnerProvider, BLOCKED_REASON } from "./providers";

/**
 * Resolve the provider from DISBURSEMENT_PROVIDER.
 *
 * Defaults to "simulated" so an unset or mistyped env var can never enable
 * real fund movement by accident. "mpesa" enables the Daraja M-Pesa provider
 * (STK Push primary, B2C fallback) when all 5 MPESA_* env vars are present.
 */
export function getDisbursementProvider(): DisbursementProvider {
  const configured = (process.env.DISBURSEMENT_PROVIDER ?? "simulated").toLowerCase();
  if (configured === "mpesa") return new MpesaProvider();
  if (configured === "partner") return new PartnerProvider();
  return new SimulatedProvider();
}

export const disbursement = getDisbursementProvider();
