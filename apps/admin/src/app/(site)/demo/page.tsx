import { BRAND } from "@kora/brand";
import { Demo } from "./demo-client";

export const metadata = {
  title: `Demo — ${BRAND.displayName}`,
  description: "Book a 15-minute walkthrough of KoraSystems",
};

export default function DemoPage() {
  return <Demo />;
}