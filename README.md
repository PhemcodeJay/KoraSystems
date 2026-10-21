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
- M-Pesa C2B callback capture and manual reconciliation to a completed sale.
  Callbacks are not cryptographically authenticated by this app. Verify the
  receipt in the merchant statement or Daraja portal before reconciling it.
- A public landing page.
- Low-stock inventory endpoint (`GET /api/inventory/low-stock`) for the POS
  dashboard, returning products at or below their reorder threshold.

Offline POS and native mobile applications are not implemented. Live
deployment, merchant-side Daraja registration, and customer acquisition still
require external setup and access.

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

- `admin@demo.kora.co.ke`
- `sme1@demo.kora.co.ke`
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
| Deploy to Vercel | ⏳ Project setup and live deployment remain |
| Get first client | ⏳ Requires a qualified prospect and authorized outreach |
| Offline POS | ⏳ Not started |
| Native mobile applications | ⏳ Not started |

## License

Proprietary. Kora Systems Inc. All rights reserved.
