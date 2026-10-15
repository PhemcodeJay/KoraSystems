import { Section, SectionHeading, Check } from "./ui";

/**
 * M-Pesa band. Real collections require Daraja credentials; disbursement stays
 * simulated until a licensed partner is configured.
 */
export function Mpesa() {
  return (
    <Section tone="white" id="mpesa">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Payments"
            title="M-Pesa collections, with money movement gated."
            sub="Customer-initiated STK payments can be enabled with Daraja credentials. Loan disbursement remains simulated until a licensed partner is in place."
          />
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <FlowColumn
              direction="Collections"
              tone="brand"
              items={["Customer STK prompts", "Asynchronous payment callbacks", "Sandbox-first configuration"]}
            />
            <FlowColumn
              direction="Disbursement"
              tone="blue"
              items={["Simulated by default", "No customer funds move", "Licensed partner required for production"]}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-ink-50/70 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Payment lifecycle
          </p>
          <ol className="mt-4 space-y-3">
            {[
              ["1", "Create a pending payment request", "text-brand-700"],
              ["2", "Daraja prompts the customer's phone", "text-blue-800"],
              ["3", "A callback records the payment result", "text-brand-700"],
            ].map(([label, amount, tone]) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-lg border border-ink-200 bg-white px-4 py-3"
              >
                <span className="text-sm text-ink-700">{label}</span>
                <span className={`text-sm font-semibold ${tone}`}>{amount}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-ink-500">
            Without Daraja credentials, collection requests are explicitly
            simulated and no money moves.
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
