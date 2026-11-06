import { createElement } from "react";
import { COLOR } from "./tokens";

/**
 * The Kora mark, as a path on a 64x64 grid. Exported as data so the app
 * shells, the favicon and the Expo app can all render the identical glyph
 * without duplicating the artwork.
 */
export const KORA_MARK_PATH =
  "M21 15 C21 15.33 21 15.66 21 16 C23.31 16 25.62 16 28 16 C28 15.67 28 15.34 28 15 C25.69 15 23.38 15 21 15 Z";

/**
 * Mark colourways. Green is the default because it is the primary brand
 * colour; gold and blue exist so the same glyph can mark a product surface
 * (SwiftPOS green, SalesPilot gold, Neobank blue) without redrawing it.
 */
export const KORA_MARK_VARIANTS = {
  green: COLOR.primary[500],
  gold: "#B37A05",
  blue: COLOR.blue[800],
} as const;

export type KoraMarkVariant = keyof typeof KORA_MARK_VARIANTS;

/** Plain inline SVG markup, for anywhere React markup is not available. */
export const koraIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${COLOR.primary[500]}"/><path d="${KORA_MARK_PATH}" fill="#fff"/></svg>`;

/**
 * React component for the Kora logo tile.
 *
 * Written with createElement rather than JSX so this file stays `.ts`: the
 * workspace packages are transpiled with extensionless imports, and the
 * bundler resolves `./logo` to `logo.ts` but not to `logo.tsx`.
 */
export function KoraLogo({
  size = 32,
  rounded = 8,
  className,
  variant = "green",
}: {
  size?: number;
  rounded?: number;
  className?: string;
  variant?: KoraMarkVariant;
} = {}) {
  return createElement(
    "span",
    {
      className,
      "aria-hidden": true,
      style: {
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: rounded,
        background: KORA_MARK_VARIANTS[variant],
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.5,
        lineHeight: 1,
        flexShrink: 0,
      },
    },
    "K",
  );
}
