"use client";

import { useEffect, useState } from "react";
import { api, apiFetch, apiJson, ApiError } from "@/lib/client";
import { Card } from "@/components/ui";

type Step = "business" | "products" | "payments";
type Status = {
  onboardingStep: string;
  businessName: string;
  mpesaTill: string | null;
  mpesaPaybill: string | null;
  mpesaPaybillPlatform?: string;
  mpesaBusinessName?: string;
  mpesaTillNumber?: string;
};

const STEPS: Step[] = ["business", "products", "payments"];
const LABELS: Record<Step, string> = {
  business: "Business info",
  products: "First product",
  payments: "Payments",
};

const input =
  "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none";

/**
 * Three-step SME setup, ported from the standalone app.
 *
 * The wizard used to POST across origins to handlers that did not exist, so
 * no step ever advanced and there was no way to tell — the failure was logged
 * and swallowed. Every step now reports its errors in the UI, and the page
 * resumes from the server's recorded step after a refresh rather than
 * restarting at business information.
 */
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("business");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [mpesaTill, setMpesaTill] = useState("");
  const [mpesaPaybill, setMpesaPaybill] = useState("");

  const [platformPaybill, setPlatformPaybill] = useState("");
  const [platformBusinessName, setPlatformBusinessName] = useState("");
  const [platformTill, setPlatformTill] = useState("");

  useEffect(() => {
    apiJson<Status>(api.onboardingStatus.path)
      .then((s) => {
        setStatus(s);
        setBusinessName(s.businessName ?? "");
        setMpesaTill(s.mpesaTill ?? "");
        setMpesaPaybill(s.mpesaPaybill ?? "");
        setPlatformPaybill(s.mpesaPaybillPlatform ?? "");
        setPlatformBusinessName(s.mpesaBusinessName ?? "");
        setPlatformTill(s.mpesaTillNumber ?? "");
        if (s.onboardingStep === "COMPLETE") setDone(true);
        else if (s.onboardingStep === "PAYMENTS") setStep("payments");
        else if (s.onboardingStep === "PRODUCTS") setStep("products");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load onboarding status.");
      });
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (step === "business") {
        await apiFetch(api.onboardingStep.path, {
          method: "POST",
          body: {
            step: "BUSINESS_INFO",
            data: {
              businessName,
              businessType,
              county,
              town,
              registrationNumber,
              yearsInBusiness: yearsInBusiness
                ? parseInt(yearsInBusiness, 10)
                : undefined,
            },
          },
        });
        setStep("products");
      } else if (step === "products") {
        await apiFetch(api.products.path, {
          method: "POST",
          body: {
            name: productName,
            sku,
            price: parseFloat(price),
            stockQuantity: parseInt(stock, 10),
          },
        });
        setStep("payments");
      } else {
        await apiFetch(api.onboardingComplete.path, {
          method: "POST",
          body: { mpesaTill, mpesaPaybill },
        });
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save that step.");
    } finally {
      setBusy(false);
    }
  }

  if (done || status?.onboardingStep === "COMPLETE") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Setup complete">
          <p className="text-sm text-ink-600">
            Your business profile is active. You can trade from the point of
            sale and adjust stock from Inventory whenever you are ready.
          </p>
        </Card>
      </div>
    );
  }

  const idx = STEPS.indexOf(step);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Set up your business</h1>
        <p className="mt-0.5 text-sm text-ink-500">Step {idx + 1} of 3</p>
      </div>

      <div className="flex gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={
              "h-2 flex-1 rounded-full " +
              (i <= idx ? "bg-brand-600" : "bg-ink-200")
            }
          />
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <Card title={LABELS[step]}>
        <div className="space-y-4">
          {step === "business" && (
            <>
              <input
                className={input}
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <input
                className={input}
                placeholder="Business type (retail, services…)"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
              <input
                className={input}
                placeholder="Registration number (optional)"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className={input}
                  placeholder="County"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Town"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                />
              </div>
              <input
                className={input}
                type="number"
                min={0}
                placeholder="Years in business"
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(e.target.value)}
              />
            </>
          )}

          {step === "products" && (
            <>
              <input
                className={input}
                placeholder="Product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
              <input
                className={input}
                placeholder="SKU"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className={input}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price (KES)"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="Stock quantity"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </>
          )}

          {step === "payments" && (
            <>
              <p className="text-sm text-ink-500">
                Add a business Till or Paybill shortcode to receive direct
                C2B payments. You can do this later — the wizard completes
                without one.
              </p>
              <div className="space-y-3">
                <input
                  className={input}
                  inputMode="numeric"
                  placeholder="M-Pesa Till shortcode (optional)"
                  value={mpesaTill}
                  onChange={(e) => setMpesaTill(e.target.value)}
                />
                <input
                  className={input}
                  inputMode="numeric"
                  placeholder="M-Pesa Paybill shortcode (optional)"
                  value={mpesaPaybill}
                  onChange={(e) => setMpesaPaybill(e.target.value)}
                />
              </div>

              {platformPaybill && (
                <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
                  <h4 className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">
                    Platform Paybill (subscription / onboarding payments)
                  </h4>
                  <p className="text-sm text-ink-700">
                    Pay to <strong>{platformPaybill}</strong>{" "}
                    {platformBusinessName && (
                      <span className="text-ink-500">— {platformBusinessName}</span>
                    )}
                    <br className="hidden sm:block" />
                    Use your phone number as the account reference.
                  </p>
                </div>
              )}
              {platformTill && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                  <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Platform Buy Goods / Till (customer pays you)
                  </h4>
                  <p className="text-sm text-ink-700">
                    Customers pay to Till <strong>{platformTill}</strong> for
                    goods and services.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {idx > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              onClick={() => setStep(STEPS[idx - 1])}
              disabled={busy}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            onClick={submit}
            disabled={busy || (step === "business" && !businessName.trim())}
          >
            {busy
              ? "Saving…"
              : step === "payments"
                ? "Complete setup"
                : "Continue"}
          </button>
        </div>
      </Card>
    </div>
  );
}
