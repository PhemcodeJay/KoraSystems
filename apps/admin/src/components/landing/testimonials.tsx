import { Section, SectionHeading } from "./ui";

/** "Be our first pilot client" — no fake social proof. */ export function Testimonials() {
  return (
    <Section>
      <SectionHeading
        eyebrow="Be our first pilot client"
        title="KoraSystems for early adopters"
        sub="Get free setup and 50% off for 3 months. Be part of shaping the future of African SME commerce."
      />
      <div className="mt-10 text-center text-sm text-ink-600">
        <p>No quotes yet — because we will just getting started. <a href="/register" className="font-medium text-brand-600 hover:underline">Start your free trial</a>.</p>
      </div>
    </Section>
  );
}
