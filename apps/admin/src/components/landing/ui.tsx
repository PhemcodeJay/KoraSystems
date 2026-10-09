import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * Shared primitives for the public marketing landing page.
 *
 * Every section composes these so spacing, width, type scale and colour stay
 * consistent and the whole page reads as one system. The palette comes from the
 * Tailwind scales configured in `tailwind.config.ts` (brand = green, accent =
 * gold, blue = trust, ink = neutral), so a brand rebalance flows through here
 * with no per-section edits.
 */

/** Centred max-width wrapper used by every landing band. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mx-auto max-w-6xl px-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

/** A marketing band with consistent vertical rhythm and a background tone. */
export function Section({
  id,
  children,
  tone = "light",
  className,
}: {
  id?: string;
  children: ReactNode;
  tone?: "light" | "white" | "dark";
  className?: string;
}) {
  return (
    <section
      id={id}
      className={clsx(
        "py-16 sm:py-20",
        tone === "white"
          ? "border-y border-ink-200 bg-white"
          : tone === "dark"
            ? "bg-ink-900 text-white"
            : "bg-ink-50",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Small uppercase label that sits above a section heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
      {children}
    </p>
  );
}

/** Section heading plus optional subhead, centred or left aligned. */
export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      className={clsx(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-3 text-base text-ink-600">{sub}</p>}
    </div>
  );
}

/** Bullet with a green tick, used across product, feature and pricing lists. */
export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-0.5 text-brand-600">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}
