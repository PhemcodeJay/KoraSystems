import { guardApp } from "@/lib/entitlement-guard";

/**
 * SwiftPOS.
 *
 * A Server Component layout so the entitlement is checked before the till
 * renders. The page itself is a Client Component and had no guard at all, so
 * SwiftPOS was reachable on every tier despite being sold from Growth upward.
 */
export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardApp("swiftpos");
  return <>{children}</>;
}