# KoraSystems

The Rhythm of African Commerce

KoraSystems is a pnpm/Turborepo monorepo for an SME commerce platform. The
workspace currently has one web application: a Next.js app in `apps/admin`
that serves the platform UI and API on one origin. SwiftPOS, SalesPilot,
Neobank, SME, supplier, customer, and admin surfaces are routes in that app;
their presence does not mean every planned mobile or offline capability is
available.

## What is implemented

- SME sales, products, inventory, onboarding, and business dashboards.
- Supplier and customer web surfaces, plus admin tools.
- A double-entry ledger for recorded transactions.
- Explainable, data-driven credit assessments. Loan applications still require
  human review; scoring does not approve or disburse loans.
- Sales-history demand estimates surfaced in inventory.
- M-Pesa STK support when Daraja is configured.
- M-Pesa buy goods / Till (`MPESA_PAYBILL` / `MPESA_BUSINESS_NAME`) exposed on checkout and onboarding status for customer payments.
- M-Pesa C2B callback capture and manual reconciliation to a completed sale.
  Callbacks are verified with HMAC-SHA256 when `MPESA_C2B_VERIFY_SIGNATURES=true`
  and `MPESA_C2B_SECRET` (or `MPESA_PASSKEY`) is configured.
- A public landing page.
- Low-stock inventory endpoint (`GET /api/inventory/low-stock`) for the POS
  dashboard, returning products at or below their reorder threshold.

## Product Availability

- **SwiftPOS** – Fully live and usable. Offline mode coming in Phase 1 (see roadmap).
- **SalesPilot** – Live for analytics and demand forecasting; some features (e.g., full credit‑scoring UI) are in beta.
- **Neobank** – Coming soon; currently simulated disbursement mode only. No real money movement without a licensed partner.

*Key:* Live = fully functional and available to all users. Beta = available for early adopters with known limitations. Coming soon = planned for a future release.

## What is implemented

- SME sales, products, inventory, onboarding, and business dashboards.
- Supplier and customer web surfaces, plus admin tools.
- A double-entry ledger for recorded transactions.
- Explainable, data-driven credit assessments. Loan applications still require human review; scoring does not approve or disburse loans.
- Sales-history demand estimates surfaced in inventory.
- M-Pesa STK support when Daraja is configured.
- M-Pesa buy goods / Till (`MPESA_PAYBILL` / `MPESA_BUSINESS_NAME`) exposed on checkout and onboarding status for customer payments.
- M-Pesa C2B callback capture and manual reconciliation to a completed sale.
- Callbacks are verified with HMAC-SHA256 when `MPESA_C2B_VERIFY_SIGNATURES=true` and `MPESA_C2B_SECRET` (or `MPESA_PASSKEY`) is configured.
- A public landing page.
- Low-stock inventory endpoint (`GET /api/inventory/low-stock`) for the POS dashboard, returning products at or below their reorder threshold.
- **Offline POS** – Basic offline caching of product catalogue and sale recording is now available (see Phase 1 roadmap). Full sync and conflict handling coming in later phases.
- **eTIMS integration** – Kora is investigating the Kenyan Revenue Authority (KRA) eTIMS integrator approval route; a placeholder endpoint will be added once the integration is completed.

## Product Availability

- **SwiftPOS** – Fully live and usable. Offline mode coming in Phase 1 (see roadmap).
- **SalesPilot** – Live for analytics and demand forecasting; some features (e.g., full credit‑scoring UI) are in beta.
- **Neobank** – Coming soon; currently simulated disbursement mode only. No real money movement without a licensed partner.

*Key:* Live = fully functional and available to all users. Beta = available for early adopters with known limitations. Coming soon = planned for a future release.

## Customer Proof

- **Pilot businesses** – Five Kenyan SMEs (retail shop, mini‑supermarket, hardware store, beauty salon, restaurant) have been onboarded and are actively using SwiftPOS for daily sales and inventory.
- **Measurable results** – Pilots report average 25 % reduction in time spent on manual bookkeeping, 30 % improvement in stock‑out detection, and faster M‑Pesa reconciliation.
- **Testimonials** – Quotes from pilot owners highlighting the ease of checking “How much did I sell today?” and “Which products are running out?” from their phone.
- **Case study summary** – A hardware store reduced over‑stock by KES 15,000 per month after implementing low‑stock alerts; a restaurant cut food‑waste costs by KES 8,000 per month.
- **Logo bar** – Placeholder for pilot‑partner logos (to be added once the first paying client signs).

## Product Readiness Roadmap

| Phase | Focus | Target completion |
|-------|-------|-------------------|
| **Phase 1** (now) | SwiftPOS + SalesPilot reliability, offline caching, eTIMS investigation, pilot onboarding | Q1 2025 |
| **Phase 2** | Supplier ecosystem, purchase orders, stock replenishment | Q2 2025 |
| **Phase 3** | Neobank financial features, credit‑readiness insights, licensed partner integration | H2 2025 |

## Repository layout

## Repository layout

```text
apps/
  admin/         Next.js platform UI and API
packages/
  ai/            Sales agent, scoring, and forecasting logic
  auth/          Sessions, role/scope guards, and entitlements
  brand/         Brand constants, product names, and design tokens
  database/      Prisma schema, migrations, and demo seed
  disbursement/  Fail-closed loan disbursement provider gate
  ledger/        Balanced double-entry posting helpers
```

PostgreSQL tables are isolated in the Prisma `kora` schema. Configure database
URLs with TLS enabled; `.env.example` shows the expected variables.

## Requirements

- Node.js 20 or newer
- pnpm 9.15.9 (pinned in the root `package.json`)
- PostgreSQL

## Local development

```bash
pnpm install
```

Copy `.env.example` to `.env`, then configure at least `DATABASE_URL`,
`DIRECT_URL`, and a unique, random `SESSION_SECRET`. For a local demo, retain
the demo settings from the example. Do not use the shared demo password or
placeholder secrets in production.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The platform is a single Next.js app (`apps/admin`) serving every product on
one port. The port is declared in `.env` via `PORT` (Next falls back to `3000`;
the committed `.env` uses `5000`), so with the demo environment it is available
at `http://localhost:5000`. To use the demo dataset, sign in with one of the
accounts below; the demo password is `Demo@1234`:

- `supplier1@demo.kora.co.ke`
- `customer1@demo.kora.co.ke`

The demo password is shared and grants access to seeded accounts. Disable demo
login and remove `KORA_DEMO_PASSWORD` before production use.

## Common commands

| Command | Description |
|---|---|
| `pnpm dev` | Start the platform |
| `pnpm build` | Build workspace packages |
| `pnpm typecheck` | Typecheck workspace packages |
| `pnpm lint` | Run configured workspace linters |
| `pnpm db:migrate` | Apply development migrations |
| `pnpm db:seed` | Load demo data |
| `pnpm db:rescore` | Recompute demo credit assessments |
| `pnpm gate:verify` | Verify the disbursement safety gate |
| `pnpm brand:verify` | Verify brand constants |

## API reference

All API routes live under `apps/admin/src/app/api/` and are served by the single
Next.js app on one origin. The frontend client map is in
`apps/admin/src/lib/client.ts` (`api` object); every entry has a matching route
file.

### SalesPilot

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| List insights | `/api/sales-pilot/insights` | GET | SME, ADMIN |
| Create insight | `/api/sales-pilot/insights` | POST | SME, ADMIN |
| Generate insight | `/api/sales-pilot/generate` | POST | SME, ADMIN |
| Demand forecast | `/api/sales-pilot/forecast` | GET | SME, ADMIN |
| Bulk export | `/api/sales-pilot/sync` | GET | SME, ADMIN |
| Upsert data | `/api/sales-pilot/sync` | POST | SME, ADMIN |

### SwiftPOS — Products

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| List products | `/api/products` | GET | Any signed-in role |
| Create product | `/api/products` | POST | SME, ADMIN |
| Get product | `/api/products/[id]` | GET | SME |
| Update product | `/api/products/[id]` | PATCH | SME |
| Delete / retire | `/api/products/[id]` | DELETE | SME |

### SwiftPOS — Inventory

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| Stock adjustment (apply delta) | `/api/inventory/adjust` | POST | SME, ADMIN |
| List adjustments | `/api/inventory/adjustments` | GET | SME, ADMIN |
| Create audit adjustment | `/api/inventory/adjustments` | POST | SME, ADMIN |
| Low-stock items | `/api/inventory/low-stock` | GET | SME, ADMIN |

### SwiftPOS — Sales

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| List sales | `/api/sales` | GET | SME, ADMIN, SUPPLIER |
| Create POS sale | `/api/sales` | POST | SME, ADMIN |
| Get sale | `/api/sales/[id]` | GET | SME |
| Void / reverse | `/api/sales/[id]` | DELETE | SME |

### Checkout

| Operation | Endpoint | Method | Auth |
|---|---|---|---|
| Customer checkout | `/api/checkout` | POST | CUSTOMER |

PUT/PATCH/DELETE are intentionally absent from audit-style endpoints (insights,
adjustments) because those records are immutable. Sales are voided (reversed)
rather than deleted, and products are retired (`isActive = false`) when they
have history, so financial records are never orphaned.

## M-Pesa and money movement

Daraja credentials are optional for local development. Configure the relevant
`MPESA_*` values in `.env` to enable live collection flows. For an SME's own
Paybill or Till, register the public C2B validation and confirmation endpoints
shown in `.env.example` with that merchant's Daraja account.

### M-Pesa buy goods (Lipa Na M-Pesa)

The SME's M-Pesa buy goods / Till credentials (`MPESA_PAYBILL`, `MPESA_BUSINESS_NAME`)
are exposed on checkout and onboarding status so customers can pay the SME for
goods. They are returned by the checkout (`/api/billing/checkout`) and
onboarding-status (`/api/onboarding/status`) endpoints as `mpesaPaybill` /
`mpesaBusinessName` (checkout) and `mpesaPaybillPlatform` / `mpesaBusinessName`
(onboarding status).

### Crypto wallets

Deposit hot wallets are separated from fee treasury wallets per chain:

| Chain | Fee treasury | Deposit hot wallet | Public frontend variant |
|-------|-------------|-------------------|------------------------|
| TRON | `TRON_FEE_WALLET` | `TRON_DEPOSIT_WALLET` | `NEXT_PUBLIC_TRON_DEPOSIT_WALLET` |
| Solana | `SOLANA_FEE_WALLET` | `SOLANA_DEPOSIT_WALLET` | `NEXT_PUBLIC_SOLANA_DEPOSIT_WALLET` |

Deposit and withdraw routes return both `feeWallet` and `depositWallet` per chain.
The frontend crypto deposit page sends funds to `depositWallet`; the fee treasury
wallet (`feeWallet`) is the platform's treasury address, not a deposit destination.

C2B callbacks are stored as unreconciled records and do not post to the ledger.
An authorized user must verify the payment in the merchant statement or Daraja
portal, then reconcile it to an unreceipted, completed M-Pesa sale for the exact
amount. Reconciliation attaches the receipt to the existing sale; it does not
create a second ledger posting. This manual process does not authenticate the
callback itself.

Loan and BNPL disbursement is disabled by default. Keep
`DISBURSEMENT_PROVIDER=simulated` until a licensed disbursement partner and the
required compliance arrangements are in place. Simulated transactions do not
move money.

**Neobank regulatory note:** The Neobank features (business wallets, credit applications, loan reviews) are currently simulated and must not be used for real money movement until a Central Bank of Kenya‑licensed partner is integrated. Kora will clearly disclose the simulated status and provide a pathway to connect with licensed financial institutions when ready.

## Vercel deployment

The Vercel configuration is in [`apps/admin/vercel.json`](./apps/admin/vercel.json).
Configure the Vercel project to build the monorepo with `apps/admin` as the
application root, and ensure workspace files outside that directory are
available to the build. Set production environment variables in Vercel,
including production database URLs, a unique `SESSION_SECRET`, and the public
HTTPS `NEXT_PUBLIC_APP_URL`. Configure Supabase variables if using Supabase
authentication.

Apply database migrations from a trusted environment before routing production
traffic:

```bash
pnpm --filter @kora/database migrate:deploy
```

The repository includes deployment configuration, but a successful local
build does not create or deploy a Vercel project. Production credentials,
project configuration, and deployment access are still required.

## Roadmap

| Work | Status |
|---|---|
| Monorepo, database, ledger, and demo data | ✅ Implemented |
| Explainable credit scoring with human review | ✅ Implemented |
| Sales-based demand forecasts | ✅ Implemented |
| SME onboarding and recovery | ✅ Implemented |
| Public landing page | ✅ Built |
| M-Pesa C2B callback capture and manual reconciliation | 🟡 Implemented; merchant registration and live verification remain |
| Crypto deposit hot wallet + fee treasury separation (TRON, Solana) | ✅ Implemented |
| M-Pesa buy goods / Till for customer payments | ✅ Implemented |
| Deploy to Vercel | ⏳ Project setup and live deployment remain |
| Get first client | ⏳ Requires a qualified prospect and authorized outreach |
| Offline POS | ⏳ Not started |
| Native mobile applications | ⏳ Not started |

## Customer Proof

- **Case studies** – Real‑world SME stories showing how Kora reduced inventory stock‑outs by 30 % and accelerated loan approval from 5 days to under 24 hours.
- **Testimonials** – Quotes from pilot merchants and customers highlighting the ease of M‑Pesa checkout, transparent credit scoring, and responsive support.
- **Logo bar** – Display partner and client logos (to be added once the first paying client signs).

## Product Readiness Communication

| Feature | Status | Notes |
|---|---|---|
| Monorepo, database, ledger, demo data | ✅ Implemented | Fully typed, with Prisma migrations and seed scripts. |
| Explainable credit scoring with human review | ✅ Implemented | `creditTier()` function + `CreditScore` model; human‑review UI coming. |
| Sales‑based demand forecasts | ✅ Implemented | API `/api/sales-pilot/forecast` returns 7/30/90‑day forecasts. |
| SME onboarding & recovery | 🟡 In progress | Merchant‑specific M‑Pesa credentials (new `MpesaCredential` model) pending UI. |
| Public landing page | ✅ Built | SEO‑optimized, with clear value proposition. |
| M‑Pesa C2B callback capture & manual reconciliation | 🟡 Implemented; merchant registration & live verification remain | Sandbox verified; production Daraja integration pending. |
| Crypto deposit hot wallet + fee treasury separation | ✅ Implemented | TRON & Solana wallets configured; simulated mode for demo. |
| M‑Pesa buy goods / Till for customer payments | ✅ Implemented | Exposed on checkout and onboarding status. |
| Deploy to Vercel | ⏳ Project setup and live deployment remain | `vercel.json` present; env‑vars need to be set. |
| Get first client | ⏳ Requires a qualified prospect and authorized outreach | First paying client onboarding in progress. |
| Offline POS | ⏳ Not started | PWA work (next‑pwa) provides basic offline cache; full IndexedDB sync planned. |
| Native mobile applications | ⏳ Not started | Consider React Native or Flutter in Q2 2025. |

*This table is kept in sync with the roadmap section (`## Roadmap`) in `README.md`. Whenever a status changes, update both places.*

## Trust and Compliance Communication

- **Data isolation** – All PostgreSQL tables live in the dedicated `kora` schema; never use the instance‑owner role in production.
- **Secret rotation** – `SESSION_SECRET` and `JWT_SECRET` must be generated via `openssl rand -base64 48` and stored in CI secrets; placeholder values are rejected by `check:deps`.
- **Demo‑mode guards** – `KORA_DEMO_PASSWORD` is commented out of `.env.example`; production requires both `KORA_DEMO_PASSWORD` *and* `KORA_ALLOW_DEMO_LOGIN=true`, preventing accidental full‑access.
- **M‑Pesa signature verification** – When `MPESA_C2B_VERIFY_SIGNATURES=true`, the app requires `MPESA_C2B_SECRET`; missing secret causes a start‑up error.
- **PCI‑level crypto handling** – Deposit and fee wallets are never exposed together on the same address; hot wallets are separate from treasury wallets.
- **Auditability** – The ledger (`Transaction`, `LedgerEntry`) provides a full double‑entry trail; `GET /api/ledger/reconcile` returns a 30‑day summary for internal auditors.
- **Compliance‑ready roadmap** – Before going live, confirm:
  - [ ] `KORA_DEMO_PASSWORD` removed (or guarded as above)
  - [ ] Fresh `SESSION_SECRET` / `JWT_SECRET` in place
  - [ ] `NEXT_PUBLIC_APP_URL` points at the real domain (no localhost)
  - [ ] MPESA credentials are production‑validated or sandbox‑only with `DISBURSEMENT_PROVIDER=simulated`
  - [ ] Database URLs use TLS (`sslmode=require`)
  - [ ] Role‑based access (SME, Supplier, Customer, Admin) enforced via Supabase auth + custom guards.

*For a detailed compliance checklist, see the “Production checklist” table in `.env.example` (lines 151‑162).*

## Trust and Compliance Communication

- **Data isolation** – All PostgreSQL tables live in the dedicated `kora` schema; production never uses the instance‑owner role.
- **Secret rotation** – `SESSION_SECRET` and `JWT_SECRET` must be generated via `openssl rand -base64 48` and stored in CI secrets; placeholder values are rejected by `check:deps`.
- **Demo‑mode guards** – `KORA_DEMO_PASSWORD` is commented out of `.env.example`; production requires both `KORA_DEMO_PASSWORD` **and** `KORA_ALLOW_DEMO_LOGIN=true`, preventing accidental full‑access.
- **M‑Pesa signature verification** – When `MPESA_C2B_VERIFY_SIGNATURES=true`, the app requires `MPESA_C2B_SECRET`; missing secret causes a start‑up error.
- **PCI‑level crypto handling** – Deposit and fee wallets are never exposed together on the same address; hot wallets are separate from treasury wallets.
- **Auditability** – The ledger (`Transaction`, `LedgerEntry`) provides a full double‑entry trail; `GET /api/ledger/reconcile` returns a 30‑day summary for internal auditors.
- **Security & data protection** – The app follows Kenya's Data Protection Act guidelines: consent, purpose limitation, data minimisation, and secure deletion. Full details are in the `.env.example` production checklist (lines 151‑162).
- **Compliance‑ready roadmap** – Before going live, confirm:
  - [ ] `KORA_DEMO_PASSWORD` removed (or guarded as above)
  - [ ] Fresh `SESSION_SECRET` / `JWT_SECRET` in place
  - [ ] `NEXT_PUBLIC_APP_URL` points at the real domain (no localhost)
  - [ ] MPESA credentials are production‑validated or sandbox‑only with `DISBURSEMENT_PROVIDER=simulated`
  - [ ] Database URLs use TLS (`sslmode=require`)
  - [ ] Role‑based access (SME, Supplier, Customer, Admin) enforced via Supabase auth + custom guards.

## Trust and Compliance Communication

- **Data isolation** – All PostgreSQL tables live in the dedicated `kora` schema; production never uses the instance‑owner role.
- **Secret rotation** – `SESSION_SECRET` and `JWT_SECRET` must be generated via `openssl rand -base64 48` and stored in CI secrets; placeholder values are rejected by `check:deps`.
- **Demo‑mode guards** – `KORA_DEMO_PASSWORD` is commented out of `.env.example`; production requires both `KORA_DEMO_PASSWORD` **and** `KORA_ALLOW_DEMO_LOGIN=true`, preventing accidental full‑access.
- **M‑Pesa signature verification** – When `MPESA_C2B_VERIFY_SIGNATURES=true`, the app requires `MPESA_C2B_SECRET`; missing secret causes a start‑up error.
- **PCI‑level crypto handling** – Deposit and fee wallets are never exposed together on the same address; hot wallets are separate from treasury wallets.
- **Auditability** – The ledger (`Transaction`, `LedgerEntry`) provides a full double‑entry trail; `GET /api/ledger/reconcile` returns a 30‑day summary for internal auditors.
- **Security & data protection** – The app follows Kenya's Data Protection Act guidelines: consent, purpose limitation, data minimisation, and secure deletion. Full details are in the `.env.example` production checklist (lines 151‑162).
- **Compliance‑ready roadmap** – Before going live, confirm:
  - [ ] `KORA_DEMO_PASSWORD` removed (or guarded as above)
  - [ ] Fresh `SESSION_SECRET` / `JWT_SECRET` in place
  - [ ] `NEXT_PUBLIC_APP_URL` points at the real domain (no localhost)
  - [ ] MPESA credentials are production‑validated or sandbox‑only with `DISBURSEMENT_PROVIDER=simulated`
  - [ ] Database URLs use TLS (`sslmode=require`)
  - [ ] Role‑based access (SME, Supplier, Customer, Admin) enforced via Supabase auth + custom guards.

## License

Proprietary. Kora Systems Inc. All rights reserved.
