/**
 * Kora design tokens.
 *
 * Exported as plain values for Tailwind/TS consumers and as `tokens.css` for
 * CSS custom properties. Keep both in sync: the CSS file is the source of
 * truth for the web apps, this file for React Native (Expo).
 *
 * Palette rationale: the three brand colours are growth (green), value and
 * momentum (gold), and institutional trust (deep blue). Green is the primary
 * because it signals money moving forward; gold is reserved for actions and
 * alerts so it never competes with status colour; blue anchors anything that
 * needs to read as official — banking, documents, admin.
 *
 * The three specified brand hexes are emerald-500 (#10b981), amber-500
 * (#f59e0b) and blue-800 (#1e40af). Each is the 500 stop of its scale, except
 * blue, which sits at 800 because a 500-step blue is too light to carry white
 * text for the KoraBank surfaces.
 */

export const COLOR = {
  // Brand — green. #10b981 at 500.
  primary: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  },
  // Brand — gold. #f59e0b at 500. Also the accent/action colour.
  accent: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    950: "#451a03",
  },
  // Brand — blue. #1e40af at 800.
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  // Neutral
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  // Semantic — derived from the brand scales so status colour can never
  // drift from the palette it is meant to sit beside.
  success: { DEFAULT: "#10b981", foreground: "#ffffff" },
  warning: { DEFAULT: "#f59e0b", foreground: "#ffffff" },
  danger: { DEFAULT: "#d92d20", foreground: "#ffffff" },
  info: { DEFAULT: "#1e40af", foreground: "#ffffff" },
} as const;

/**
 * The three headline brand colours, by role.
 *
 * Exported separately from `COLOR` so product surfaces and marketing copy can
 * reference the brand palette by meaning ("this is the action colour") rather
 * than by scale index, which makes a future rebalance a one-line change.
 */
export const BRAND_COLORS = {
  green: "#10b981",
  gold: "#f59e0b",
  blue: "#1e40af",
} as const;

export type BrandColor = keyof typeof BRAND_COLORS;

/** Risk bands, aligned to `CreditRiskLevel` in the Prisma schema. */
export const RISK_COLOR = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  VERY_HIGH: "danger",
} as const;

/** Loan status, aligned to `LoanStatus` in the Prisma schema. */
export const LOAN_STATUS_COLOR = {
  PENDING_REVIEW: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  DISBURSEMENT_PENDING: "warning",
  DISBURSED: "success",
  REPAYING: "info",
  SETTLED: "neutral",
  DEFAULTED: "danger",
  BLOCKED_NO_PARTNER: "neutral",
} as const;

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 } as const;

export const RADIUS = { sm: 6, md: 10, lg: 14, full: 9999 } as const;

export const FONT = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const TAP_TARGET = 44;
