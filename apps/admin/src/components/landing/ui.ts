import { Container as NextContainer } from "next/dist/shared/lib/utils";

/**
 * Wrapper component that provides consistent content padding and max-width.
 * Used across the admin app for consistent layout.
 */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <NextContainer className={className}>
      {children}
    </NextContainer>
  );
}