/**
 * Platform navigation model.
 *
 * Grouped, role-filtered nav. Every link is re-verified server-side:
 * `roles`/`heldBy` only decide *what is offered*, never what is *allowed*.
 */

import { appsForTier, type Tier } from "@kora/auth/entitlements";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: string[];
  heldBy?: string;
  /**
   * The product that unlocks this link, if any. A link whose product the
   * subscriber's plan does not include is hidden rather than shown as a
   * dead end — the route would redirect to the app hub anyway.
   */
  app?: "salespilot" | "swiftpos" | "neobank";
};

export type NavSection = { group: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    group: "Business",
    items: [
      { href: "/home", label: "Overview", icon: "\u25BE", roles: ["ADMIN", "SME", "SUPPLIER"] },
      { href: "/pos", label: "Point of sale", icon: "\u25A3", roles: ["SME"], app: "swiftpos" },
      { href: "/sme/inventory", icon: "\u25FB", label: "Inventory", roles: ["SME"], app: "swiftpos" },
      { href: "/sme/sales", label: "Sales", icon: "\u21C5", roles: ["SME", "ADMIN"], app: "salespilot" },
      { href: "/sme/customers", label: "Customers", icon: "\u263A", roles: ["SME"] },
      { href: "/sme/suppliers", label: "Suppliers", icon: "\u26DF", roles: ["SME"] },
      { href: "/sme/onboarding", label: "Setup", icon: "\u2699", roles: ["SME"] },
      { href: "/team", label: "Team", icon: "\u263A", roles: ["SME"] },
      { href: "/billing", label: "Billing", icon: "\u25C8", roles: ["SME"] },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/sme/loans", label: "Loans", icon: "\u25C8", roles: ["SME", "ADMIN"] },
      { href: "/sme/savings", label: "Savings", icon: "\u2B22", roles: ["SME"] },
      { href: "/payments", label: "Payments", icon: "\u21C4", roles: ["SME", "SUPPLIER", "ADMIN"] },
      { href: "/supplier/orders", label: "Orders", icon: "\u2189", roles: ["SUPPLIER", "SME", "ADMIN"], heldBy: "SUPPLIER" },
      { href: "/supplier/invoices", label: "Invoices", icon: "\u25A4", roles: ["SUPPLIER", "SME", "ADMIN"], heldBy: "SUPPLIER" },
    ],
  },
  {
    group: "Shopping",
    items: [
      { href: "/customer/shop", label: "Shop", icon: "\uD83D\uDED2", roles: ["CUSTOMER", "SME"] },
      { href: "/customer/cart", label: "Cart", icon: "\uD83D\uDED1", roles: ["CUSTOMER"] },
    ],
  },
  {
    group: "Platform",
    items: [
      { href: "/admin/overview", label: "Console", icon: "\u25A6", roles: ["ADMIN"] },
      { href: "/admin/smes", label: "Businesses", icon: "\u25FB", roles: ["ADMIN"] },
      { href: "/admin/loans", label: "Credit desk", icon: "\u25C8", roles: ["ADMIN"] },
      { href: "/admin/transactions", label: "Ledger", icon: "\u21C4", roles: ["ADMIN"] },
      { href: "/admin/reports", label: "Reports", icon: "\u2696", roles: ["ADMIN"] },
      { href: "/admin/users", label: "Users", icon: "\u263A", roles: ["ADMIN"] },
    ],
  },
  {
    group: "NeoBank",
    items: [
      { href: "/neobank", label: "Dashboard", icon: "\uD83C\uDFE6", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
      { href: "/neobank/accounts", label: "Accounts", icon: "\uD83C\uDFE6", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
      { href: "/neobank/crypto", label: "Crypto", icon: "\u20BF", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
      { href: "/neobank/cards", label: "Cards", icon: "\uD83D\uDC13", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
      { href: "/neobank/investments", label: "Investments", icon: "\u2696", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
      { href: "/neobank/insurance", label: "Insurance", icon: "\u2661", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"], app: "neobank" },
    ],
  },
];

/**
 * Whether the given plan tier unlocks a product.
 *
 * ADMIN is staff, not a subscriber, so they are never locked out of a product
 * they need to operate — the server-side guard still applies.
 */
export function tierAllows(tier: string | undefined, app: NavItem["app"]): boolean {
  if (!app) return true;
  if (!tier) return false;
  return appsForTier(tier as Tier).includes(app);
}
