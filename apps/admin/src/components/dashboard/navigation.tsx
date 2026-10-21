/**
 * Platform navigation model.
 *
 * Grouped, role-filtered nav. Every link is re-verified server-side:
 * `roles`/`heldBy` only decide *what is offered*, never what is *allowed*.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: string[];
  heldBy?: string;
};

export type NavSection = { group: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    group: "Business",
    items: [
      { href: "/home", label: "Overview", icon: "\u25BE", roles: ["ADMIN", "SME", "SUPPLIER"] },
      { href: "/pos", label: "Point of sale", icon: "\u25A3", roles: ["SME"] },
      { href: "/sme/inventory", label: "Inventory", icon: "\u25FB", roles: ["SME"] },
      { href: "/sme/sales", label: "Sales", icon: "\u21C5", roles: ["SME", "ADMIN"] },
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
    group: "NeoBank",
    items: [
      { href: "/neobank", label: "Dashboard", icon: "\uD83C\uDFE6", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
      { href: "/neobank/accounts", label: "Accounts", icon: "\uD83C\uDFE6", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
      { href: "/neobank/crypto", label: "Crypto", icon: "\u20BF", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
      { href: "/neobank/cards", label: "Cards", icon: "\uD83D\uDC13", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
      { href: "/neobank/investments", label: "Investments", icon: "\u2696", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
      { href: "/neobank/insurance", label: "Insurance", icon: "\u2661", roles: ["CUSTOMER", "SUPPLIER", "SME", "ADMIN"] },
    ],
  },
];
