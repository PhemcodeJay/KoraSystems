import { Container } from "./ui";

/**
 * Platform stat bar.
 *
 * Four headline numbers that frame the platform's reach. Sourced as literals
 * here because they are marketing claims, not live metrics — when a real
 * dashboard endpoint exists this should read from it rather than hard-code.
 */
const STATS = [
  { value: "5,000+", label: "SMEs served" },
  { value: "KES 2.4B", label: "Transactions processed" },
  { value: "99.9%", label: "Uptime" },
  { value: "4 roles", label: "One platform" },
];

export function Stats() {
  return (
    <div className="border-b border-ink-200 bg-white">
      <Container>
        <dl className="grid grid-cols-2 divide-ink-200 py-8 sm:grid-cols-4 sm:divide-x">
          {STATS.map((s) => (
            <div key={s.label} className="px-2 py-4 text-center sm:py-0">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block text-2xl font-bold tabular-nums text-brand-700 sm:text-3xl">
                  {s.value}
                </span>
                <span className="mt-1 block text-sm text-ink-500">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}
