import { Section, SectionHeading, Check } from "./ui";

/**
 * M-Pesa band.
 *
 * Payments are the headline for a Kenya-first product, so this gets its own
 * band split into Money In (C2B) and Money Out (B2C) — the two Daraja flows the
 * platform actually implements. The two-column layout makes the direction of
 * money obvious.
 */
export function Mpesa() {
  return (
    <Section tone="white" id="mpesa">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Payments"
            title="M-Pesa, built in — not bolted on."
            sub="KoraSystems speaks Daraja natively. Money in and money out on one balanced ledger, so your books always agree with your wallet."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FlowColumn
              direction="Money in"
              tone="brand"
              items={["Customer payments", "Sales at the till", "Loan repayments", "Pay-in-parts (BNPL)"]}
            />
            <FlowColumn
              direction="Money out"
              tone="blue"
              items={["Loan disbursement", "Supplier payouts", "Shopper refunds", "Savings withdrawals"]}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-ink-50/70 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Live from the ledger
          </p>
          <ul className="mt-4 space-y-3">
            {[
              ["M-Pesa received", "KES 4,200", "text-brand-700"],
              ["Loan disbursed", "KES 120,000", "text-blue-800"],
              ["Supplier paid", "KES 38,500", "text-brand-700"],
            ].map(([label, amount, tone]) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-4 py-3"
              >
                <span className="text-sm text-ink-700">{label}</span>
                <span className={`text-sm font-semibold tabular-nums ${tone}`}>{amount}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-500">
            Every entry posts to the same double-entry ledger — sales, loans and
            payouts reconcile automatically.
          </p>
        </div>
      </div>
    </Section>
  );
}

function FlowColumn({
  direction,
  items,
  tone,
}: {
  direction: string;
  items: string[];
  tone: "brand" | "blue";
}) {
  return (
    <div>
      <h3
        className={`text-sm font-semibold ${tone === "brand" ? "text-brand-700" : "text-blue-800"}`}
      >
        {direction}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
        {items.map((i) => (
          <Check key={i}>{i}</Check>
        ))}
      </ul>
    </div>
  );
}
