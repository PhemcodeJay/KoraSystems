/**
 * Kora brand tokens.
 *
 * Single source of truth for the product name across every app, package and
 * deployment target. Import from `@kora/brand` rather than hardcoding the
 * string, so a rebrand is a one-file change.
 *
 * Naming rule: "Kora" is the product the customer sees. "Kora Systems" is the
 * company behind it and appears in legal copy, invoices and page titles.
 */

// Re-exported for consumers, but also imported by name: `export *` creates no
// local bindings, and `verifyBrand` below reads COLOR/BRAND_COLORS directly.
import { BRAND_COLORS, COLOR, type BrandColor } from "./tokens";

export * from "./tokens";
export * from "./logo";

export const BRAND = {
  /** Product name shown in the UI, emails and app titles. */
  name: "KoraSystems",
  /** Spaced form, for wordmark lockups where "KoraSystems" would read as one word. */
  displayName: "Kora Systems",
  /** Company name, for legal copy and page titles. */
  legalName: "Kora Systems",
  /** Registered entity, for contracts and terms. */
  legalEntity: "Kora Systems Inc",
  /** Used where space is tight, e.g. mobile tab bars and app icons. */
  shortName: "Kora",
  tagline: "The Rhythm of African Commerce",
  description:
    "Kora gives Kenyan SMEs the tools to sell, manage stock, understand demand and access credit.",
  /** Primary domain. */
  domain: "kora.co.ke",
  /** Subdomain used for demo/staging environments. */
  demoDomain: "demo.kora.co.ke",
  supportEmail: "support@kora.co.ke",
  country: "Kenya",
  currency: "KES",
  currencySymbol: "KES",
  locale: "en-KE",
} as const;

export type Brand = typeof BRAND;

/** Legal suffix shown in footers and terms. */
export const legalLine = (year: number = new Date().getFullYear()): string =>
  `© ${year} ${BRAND.legalEntity}. All rights reserved.`;

/**
 * Per-app product names.
 *
 * The three flagship products keep their original standalone names —
 * SwiftPOS, SalesPilot and Neobank — because those are the names already in
 * the market and in the vendored services. The platform surfaces that sit
 * alongside them are Kora-prefixed so users always know which app they are in.
 */
export const APPS = {
  sme: {
    key: "sme",
    name: "Kora Business",
    description: "Point of sale, stock, insights and credit for your business.",
    path: "/",
  },
  supplier: {
    key: "supplier",
    name: "Kora Supplier",
    description: "Manage orders, stock and payments from your suppliers.",
    path: "/",
  },
  customer: {
    key: "customer",
    name: "Kora Shopper",
    description: "Buy from local businesses, pay in parts, earn rewards.",
    path: "/",
  },
  admin: {
    key: "admin",
    name: "Kora Admin",
    description: "Platform operations, credit decisions and reporting.",
    path: "/admin",
  },
  // Flagship products, named as they are in the market.
  swiftpos: {
    key: "swiftpos",
    name: "SwiftPOS",
    description: "Fast offline point of sale that syncs when you reconnect.",
    path: "/",
  },
  salespilot: {
    key: "salespilot",
    name: "SalesPilot",
    description: "Sales analytics, invoicing and inventory intelligence.",
    path: "/",
  },
  neobank: {
    key: "neobank",
    name: "Neobank",
    description: "Accounts, payments and SME credit in one ledger.",
    path: "/",
  },
  // Kept as an alias so existing `APPS.pos` consumers keep resolving.
  pos: {
    key: "pos",
    name: "SwiftPOS",
    description: "Fast offline point of sale that syncs when you reconnect.",
    path: "/",
  },
  mobile: {
    key: "mobile",
    name: "Kora Supplier Mobile",
    description: "Confirm and fulfil orders on the move.",
    path: "/",
  },
} as const;

export type AppKey = keyof typeof APPS;
export type AppMeta = (typeof APPS)[AppKey];

/** Resolve an app's display name, falling back to the master brand. */
export function appName(key: AppKey | undefined): string {
  return key ? APPS[key].name : BRAND.name;
}

/** Page/document title, e.g. "Platform overview · Kora Admin". */
export function pageTitle(page?: string, app?: AppKey): string {
  const appPart = appName(app);
  return page ? `${page} · ${appPart}` : appPart;
}

export const ROLE_LABELS = {
  SME: "Business owner",
  SUPPLIER: "Supplier",
  CUSTOMER: "Customer",
  ADMIN: "Platform admin",
} as const;

// --- Verification -------------------------------------------------------
// Run with: pnpm brand:verify
//
// Lives in the source rather than in a throwaway script so the brand spec is
// enforced by something that runs in CI, not just by review. It asserts the
// three headline hexes from the brand guide and the product naming rule.

const SPEC_COLORS = {
  green: "#10b981",
  gold: "#f59e0b",
  blue: "#1e40af",
} as const;

const SPEC_PRODUCTS = ["SwiftPOS", "SalesPilot", "Neobank"] as const;

/**
 * Checks the brand against the spec. Returns every mismatch at once rather
 * than throwing on the first, so one run reports the whole picture.
 */
export function verifyBrand(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. The three headline brand colours must be exact, case-insensitively.
  for (const role of Object.keys(SPEC_COLORS) as BrandColor[]) {
    const expected = SPEC_COLORS[role].toLowerCase();
    const actual = BRAND_COLORS[role].toLowerCase();
    if (actual !== expected) errors.push(`${role}: expected ${expected}, got ${actual}`);
  }

  // 2. Each headline hex must also be reachable through its scale, because
  //    the Tailwind config and the CSS custom properties consume the scales.
  //    Blue sits at 800, not 500 — a 500-step blue cannot carry white text.
  const scales: Record<BrandColor, Record<string, string>> = {
    green: COLOR.primary,
    gold: COLOR.accent,
    blue: COLOR.blue,
  };
  const stops: Record<BrandColor, string> = { green: "500", gold: "500", blue: "800" };
  for (const role of Object.keys(scales) as BrandColor[]) {
    const expected = SPEC_COLORS[role].toLowerCase();
    const actual = scales[role][stops[role]]?.toLowerCase();
    if (actual !== expected) {
      errors.push(`scale ${role}[${stops[role]}]: expected ${expected}, got ${actual}`);
    }
  }

  // 3. The flagship products must keep their market names.
  for (const product of SPEC_PRODUCTS) {
    if (!Object.values(APPS).some((a) => a.name === product)) {
      errors.push(`missing product name: ${product}`);
    }
  }

  // 4. The legacy APPS.pos alias must stay in step with APPS.swiftpos.
  if (APPS.pos.name !== APPS.swiftpos.name) {
    errors.push(`alias APPS.pos (${APPS.pos.name}) != APPS.swiftpos (${APPS.swiftpos.name})`);
  }

  // 5. No scale may repeat a hex — the signature of a bad paste.
  for (const [name, scale] of Object.entries({ ...scales, neutral: COLOR.neutral })) {
    const seen = new Set<string>();
    for (const [stop, hex] of Object.entries(scale)) {
      if (seen.has(hex)) errors.push(`duplicate hex in ${name}: ${stop} = ${hex}`);
      seen.add(hex);
    }
  }

  // 6. The tagline is part of the spec and is rendered in shell footers and
  //    the OG image, so a silent edit would ship the wrong brand voice.
  if (BRAND.tagline !== "The Rhythm of African Commerce") {
    errors.push(`tagline: expected "The Rhythm of African Commerce", got "${BRAND.tagline}"`);
  }
  if (BRAND.name !== "KoraSystems") {
    errors.push(`name: expected "KoraSystems", got "${BRAND.name}"`);
  }

  return { ok: errors.length === 0, errors };
}
