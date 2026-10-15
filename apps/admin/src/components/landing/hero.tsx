import Link from "next/link";
import { Container, Eyebrow } from "./ui";
import { KoraLogo, APPS } from "@kora/brand";

/**
 * Hero band.
 *
 * Headline, subhead and the two calls to action, beside a stylised product mock
 * built from brand colours — no screenshot required. The CTAs swap for a
 * signed-in user so a returning visitor is never asked to create a second
 * account.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-ink-200 bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Decorative brand glows. Purely presentational, hidden from AT. */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-16 top-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />

      <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <Eyebrow>Sales · Inventory · Payments · Credit</Eyebrow>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
            The Operating System for{" "}
            <span className="text-brand-600">African Business</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-600">
            KoraSystems connects SMEs, suppliers, and customers in one platform.
            Sales, inventory, payment tracking and credit review in one place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {signedIn ? (
              <Link
                href="/home"
                className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                >
                  Start free trial
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-ink-300 bg-white px-5 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                >
                  See demo
                </Link>
              </>
            )}
          </div>

          <p className="mt-4 text-sm text-ink-500">
            90-day free trial · No card required · Built for M-Pesa
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
            {[APPS.swiftpos.name, APPS.salespilot.name, APPS.neobank.name].map((name) => (
              <span key={name} className="inline-flex items-center gap-2">
                <KoraLogo size={20} rounded={5} />
                {name}
              </span>
            ))}
          </div>
        </div>

        <ProductMock />
      </Container>
    </section>
  );
}

/**
 * A stylised dashboard mock assembled from brand colours. Stands in for a real
 * screenshot without shipping an image; each tile echoes a real surface in the
 * app (sales stat, stock, credit score) so the preview is honest about what the
 * product does.
 */
function ProductMock() {
  return (
    <div aria-hidden className="relative">
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xl ring-1 ring-ink-900/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KoraLogo size={28} rounded={7} />
            <div>
              <p className="text-sm font-semibold text-ink-900">Mama Mboga Stores</p>
              <p className="text-[11px] text-ink-500">Example workspace · SwiftPOS</p>
            </div>
          </div>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
            Live
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <MockStat label="Sales" value="KES 18.4k" tone="brand" />
          <MockStat label="Items" value="312" />
          <MockStat label="Credit review" value="Human-led" />
        </div>

        <div className="mt-4 rounded-xl border border-ink-200 p-3">
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span>Stock levels</span>
            <span>Maize flour low</span>
          </div>
          <div className="mt-2 space-y-2">
            <MockBar label="Sugar" pct={82} tone="brand" />
            <MockBar label="Cooking oil" pct={64} tone="blue" />
            <MockBar label="Maize flour" pct={18} tone="gold" />
          </div>
        </div>
      </div>

      {/* Floating credit-score chip, offset from the main card. */}
      <div className="absolute -bottom-5 -left-4 hidden rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 shadow-lg sm:block">
        <p className="text-[11px] text-ink-500">Credit decision support</p>
        <p className="text-sm font-semibold text-brand-700">Human review required</p>
      </div>
    </div>
  );
}

function MockStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "brand";
}) {
  return (
    <div
      className={
        tone === "brand"
          ? "rounded-lg bg-brand-50 p-2.5 ring-1 ring-inset ring-brand-600/10"
          : "rounded-lg bg-ink-50 p-2.5"
      }
    >
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}

function MockBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "brand" | "blue" | "gold";
}) {
  const fill =
    tone === "brand" ? "bg-brand-500" : tone === "blue" ? "bg-blue-800" : "bg-accent-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-ink-600">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-ink-100">
        <div className={`h-1.5 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
