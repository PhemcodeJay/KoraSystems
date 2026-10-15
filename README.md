# KoraSystems — The Rhythm of African Commerce

Unified platform connecting SMEs, suppliers, and customers across Africa.

## Architecture

Turborepo monorepo with pnpm workspaces.

### Apps

The platform is **one Next.js app on one port**. SwiftPOS, Neobank, SalesPilot,
the user dashboard and the admin console are *routes inside* `apps/admin`, not
separate servers — which is why there is a single port, a single session
cookie, and no cross-origin calls between our own surfaces.

| App | Port | Stack | Role |
|---|---|---|---|
| `apps/admin` | **3000** | Next.js 14 | **The platform.** The only app, and the only one with API routes. |

It covers `/pos` (SwiftPOS), `/neobank/*`, `/sme/sales` (SalesPilot), `/apps`,
`/customer/*`, `/supplier/*` and `/admin/*`.

### Packages

| Package | Role |
|---|---|
| `auth` | Sessions, role/scope guards, subscription entitlements, salted scrypt password hashing |
| `brand` | Brand constants, product names, colours, page titles |
| `database` | Prisma schema, migrations and client |
| `disbursement` | M-Pesa disbursement gate (`simulated` provider by default) |
| `ledger` | Balanced double-entry posting helpers |

These five are the platform's entire dependency closure. The standalone client
apps, the product facades, the Docker definitions and the vendored Express/PHP
services have all been removed — they duplicated routes this app already served.

## Quick Start

```bash
pnpm install              # install all workspace packages
pnpm build                # build all packages
pnpm dev                  # start the platform — one port (3000)
pnpm typecheck            # typecheck all packages
```

## Brand

- Name: KoraSystems
- Tagline: "The Rhythm of African Commerce"
- Colors: Green #10b981, Gold #f59e0b, Blue #1e40af
- Products: SwiftPOS, SalesPilot, Neobank

---

## What this is

A pnpm + Turborepo monorepo holding the Kora platform:

| Package | Purpose |
|---|---|
| `@kora/brand` | Brand constants and design tokens — single source of truth for the product name |
| `@kora/database` | Prisma schema (23 models) on an isolated `kora` Postgres schema, plus the demo seed |
| `@kora/ledger` | Double-entry ledger. Every money movement posts balanced legs |
| `@kora/disbursement` | Loan disbursement with a fail-closed provider gate |
| `@kora/shared` | Cross-app contract: entity types, `api` route map, Zod request schemas |

## Repository layout

```
apps/
  admin/         Kora Admin — Next.js 14. Hosts the platform API and the ledger.
  pos/           KoraPOS facade   — Next.js 14, reads/writes via the admin API
  bank/          KoraBank facade  — Next.js 14, reads/writes via the admin API
  salespilot/    CRM facade       — Next.js 14, reads/writes via the admin API

  swiftpos/      SwiftPOS service     — vendored, standalone (npm, not in workspace)
  neobank/       Neobank service      — vendored, standalone (npm, not in workspace)
  salespilot-crm/ SalesPilot CRM      — vendored, standalone (PHP/Composer)
packages/
  auth/ brand/ database/ disbursement/ ledger/ shared/
```

### Facades vs. vendored services

The three product front ends exist in two layers, deliberately:

- **Facades** (`apps/pos`, `apps/bank`, `apps/salespilot`) are thin Next.js
  apps that call the Kora admin API. Because they go through the admin API,
  every sale, wallet movement and receipt lands on the double-entry ledger.
  This is the supported platform path and the direction of travel.
- **Vendored services** (`apps/swiftpos`, `apps/neobank`, `apps/salespilot-crm`)
  are the original full-featured applications, kept deployable for existing
  installations and for offline-first work.

The vendored services are **excluded from the pnpm workspace** (see
`pnpm-workspace.yaml`). They pin mutually incompatible stacks — React 18/Vite/
Tailwind 3, React 19/Vite/Tailwind 4, and PHP — and forcing one hoisted
dependency graph across all three would be fragile. Each installs and builds on
its own; they share contracts through `@kora/shared` via tsconfig paths rather
than via the package manager.

## Brand

All naming comes from `@kora/brand` — import `BRAND`, `APPS` and `pageTitle`
rather than hardcoding strings, so a rebrand is a one-file change.

```ts
import { BRAND, APPS, COLOR, pageTitle } from "@kora/brand";

BRAND.name;        // "KoraSystems"
BRAND.tagline;     // "The Rhythm of African Commerce"
BRAND.legalEntity; // "Kora Systems Inc"
APPS.swiftpos.name; // "SwiftPOS"
pageTitle("Platform overview", "admin"); // "Platform overview · Kora Admin"
```

### Palette

Three brand colours, each a full 50–950 scale. The headline hex sits at the
500 stop, except blue, which sits at 800 because a 500-step blue cannot carry
white text for the banking surfaces.

| Role | Hex | Scale stop | Tailwind | Used for |
|---|---|---|---|---|
| Green — primary | `#10b981` | `primary.500` | `brand-*` | Money moving, POS surfaces, success |
| Gold — accent | `#f59e0b` | `accent.500` | `accent-*` | Calls to action, warnings, SalesPilot |
| Blue — trust | `#1e40af` | `blue.800` | `blue-*` | Banking, documents, admin |

```ts
import { BRAND_COLORS } from "@kora/brand";

BRAND_COLORS.green; // "#10b981"
BRAND_COLORS.gold;  // "#f59e0b"
BRAND_COLORS.blue;  // "#1e40af"
```

Semantic colours (`success`, `warning`, `info`) are derived from the brand
scales rather than chosen independently, so status colour can never drift from
the palette it sits beside.

Design tokens ship as TypeScript (`COLOR`, `SPACING`, `RADIUS`, `FONT`,
`RISK_COLOR`, `LOAN_STATUS_COLOR`) for Expo and as CSS custom properties in
`@kora/brand/tokens.css` for the web apps.

### Product naming

The three flagship products keep their original market names — **SwiftPOS**,
**SalesPilot** and **Neobank**. The platform surfaces built alongside them are
Kora-prefixed (`Kora Admin`, `Kora Business`, `Kora Supplier`, `Kora Shopper`)
so a user always knows which app they are in.

`APPS.pos` is retained as an alias of `APPS.swiftpos` so existing consumers
keep resolving; `brand:verify` fails if the two ever drift apart.

**Naming rule:** the customer always sees "KoraSystems". "Kora Systems" appears
in legal copy, invoices and document titles. "Kora Systems Inc" is the
registered entity for contracts and terms.

Run `pnpm brand:verify` to assert the name, tagline, the three headline hexes,
their scale positions, the product names and the alias all still match the
brand spec.

## Getting started

```bash
pnpm install
cp .env.example .env      # then fill in DATABASE_URL
pnpm db:migrate
pnpm db:seed
```

Requires Node 20+. `pnpm` is pinned via `packageManager` in `package.json`.

### Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Production build |
| `pnpm typecheck` | Typecheck every package |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Load the full demo dataset |
| `pnpm db:rescore` | Recompute credit scores only (fast) |
| `pnpm gate:verify` | Verify the disbursement gate (see below) |
| `pnpm brand:verify` | Verify brand name, tagline, colours and product names |

### Ports

**One port: 3000.** `PORT` in `.env` is the only place the port is declared:
`next dev` / `next start` read it and fall back to 3000, and
`NEXT_PUBLIC_APP_URL` is derived from it in `next.config.mjs`. Nothing else
hardcodes a port, so the two cannot drift apart.

| What | Port | Command |
|---|---|---|
| **The platform — all three products, dashboards and the console** | **3000** | `pnpm dev` |

To move the platform, change `PORT`; `NEXT_PUBLIC_APP_URL` follows from it.

## Database

Postgres via Prisma, isolated in its own **`kora` schema**. This is deliberate:
the shared Neon instance already holds another application's 24 tables in
`public`, with direct name collisions (`customers`, `products`, `sales`,
`users`, `invoices`). Isolating the schema means Kora can never drop or alter
someone else's data.

`sslmode=require` is mandatory — Neon rejects plaintext connections.

## The ledger

Money is never tracked in one place. `Transaction` is a header and
`LedgerEntry` holds its debit/credit legs, and every posting must balance:

```ts
await post({ reference, type, accountCode, amount, smeId }, saleLegs(total, fee), prisma);
```

Reports read `accountBalances()` rather than summing `Sale`/`Loan`/`Savings`
tables, because those can each already be represented in the ledger — summing
both would double count. `findUnbalanced()` audits the whole book.

## Disbursement gate

Loan and BNPL disbursement is **disabled by default**. `DISBURSEMENT_PROVIDER`
defaults to `simulated`, which writes a balanced ledger entry flagged
`simulated: true` and parks the loan at `BLOCKED_NO_PARTNER`. It never moves
money.

This is intentional, not unfinished plumbing. Holding customer and loan funds
in one M-Pesa paybill and disbursing credit from it is the profile of an
unlicensed lending operation, and in Kenya both digital credit and BNPL sit
inside the CBK's regulatory perimeter. The gate keeps the product fully
buildable and testable while real fund movement waits for a licensed partner.

`pnpm gate:verify` asserts this holds — including that a mistyped env var
falls back to `simulated`, and that no loan ends up with a disbursement date.

## Demo data

`pnpm db:seed` creates 71 users, 6 SMEs, 4 suppliers, 60 customers, 48
products, **30,429 sales across 365 days**, 120 orders, 5 loans, 15 BNPL plans
and 5 savings accounts. Sales carry weekday seasonality, a growth trend and a
promo spike, so forecasting and scoring have real signal rather than a flat
line. One SME is deliberately near-zero-volume to exercise the sparse-data
path.

Sign in with any of these (password `Demo@1234`):
`admin@demo.kora.co.ke` · `sme1@demo.kora.co.ke` · `supplier1@demo.kora.co.ke` · `customer1@demo.kora.co.ke`

## Roadmap

The monorepo, database, ledger and demo data are complete. Remaining work is
prioritized below:

| Priority | Remaining work |
|---|---|
| 🔴 High | Finish AI credit scoring |
| 🔴 High | Finish AI demand forecasting |
| 🔴 High | Finish SME onboarding |
| 🔴 High | Deploy to Vercel |
| 🔴 High | Build landing page |
| 🔴 High | Get first client |
| 🟡 Medium | Integrate M-Pesa C2B |
| 🟡 Medium | Build offline POS |

## Security note

`.env` is gitignored and must never be committed. The demo password is
intentionally shared; real credentials are not.
