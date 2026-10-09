import { Section, Container } from "./ui";

/**
 * Dark statement band.
 *
 * The pivot from problem to solution. Uses the `dark` section tone so it breaks
 * the light rhythm of the surrounding bands and reads as a beat, not another
 * feature card.
 */
export function Statement() {
  return (
    <Section tone="dark">
      <Container className="text-center">
        <p className="mx-auto max-w-3xl text-2xl font-bold leading-snug sm:text-3xl">
          KoraSystems runs the whole business from one system — the till, the stock room,
          the bank and the loan.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-ink-300">
          One account for the shop owner, the supplier and the shopper. The same ledger
          under all three.
        </p>
      </Container>
    </Section>
  );
}
