# KoraSystems — Render Setup Guide

This guide walks through deploying KoraSystems on [Render](https://render.com). It covers creating the Render Postgres database, the web service, environment variables, Prisma migrations, and the demo seed.

## Prerequisites

- A Render account (free tier works for evaluation)
- The KoraSystems repo pushed to GitHub (Render deploys from Git)
- Node.js >= 20 and pnpm 9.15.9 locally (only needed if you want to test the build locally)

## Overview of the app

KoraSystems is a **single Next.js 14 app** (`apps/admin`) served by one port. It is a pnpm/Turborepo monorepo with one app and six workspace packages (`@kora/auth`, `@kora/brand`, `@kora/database`, `@kora/disbursement`, `@kora/ledger`, `@kora/ai`).

Next reads `PORT` from the environment and falls back to `3000`. Render injects `$PORT` automatically, so no code change is needed to bind the right port.

The `.env` file is **gitignored** and never committed. All secrets must be set in the Render dashboard (or `render.yaml`).


## Step 1 — Create a Render Postgres database

1. In the Render dashboard, click **New** → **PostgreSQL**.
2. Name it `kora-db` (or similar).
3. Choose a region close to your users.
4. Select the instance plan (free tier is fine for testing).
5. Click **Create Database**.

Once provisioned, copy the **Internal Database URL** — Render will expose it as `DATABASE_URL` to services in the same account/region.

## Step 2 — Create the web service

1. Click **New** → **Web Service**.
2. Connect the KoraSystems GitHub repository.
3. Configure:

| Field | Value |
|-------|-------|
| Name | `kora-platform` |
| Environment | `Node` |
| Region | same region as the database |
| Branch | `main` |
| Root Directory | `/` (repo root) |
| Build Command | `pnpm install && pnpm build` |
| Start Command | `PORT=$PORT pnpm start` |
| Instance Type | Free (or paid for production) |

> **Why `PORT=$PORT pnpm start`?** Render passes the listening port in `$PORT`. `scripts/dev.mjs` forwards `PORT` through to Next, so the app binds to Render's expected port. The `start` script runs `node scripts/dev.mjs start`, which launches `next start` (production server) from `apps/admin`.

4. Under **Advanced**, add the database you created in Step 1 so Render injects `DATABASE_URL` automatically. If you don't use the auto-link, add `DATABASE_URL` manually in the next step.

5. Click **Create Web Service**.

## Step 3 — Set environment variables

In the Render dashboard, go to your web service → **Environment**, and add the following variables:

### Required

| Variable | Value / Notes |
|----------|---------------|
| `DATABASE_URL` | Render Postgres Internal Database URL (from Step 1). Must include `?sslmode=require`. |
| `DIRECT_URL` | Same as `DATABASE_URL`, used by Prisma migrations (direct, non-pooled connection). Render Postgres provides a direct connection string too. |
| `SESSION_SECRET` | A long random string (>= 32 chars). Generate with `openssl rand -base64 48`. **Never use the placeholder.** The app refuses to start on placeholder/short secrets. |
| `JWT_SECRET` | Another long random string (>= 32 chars). |
| `PORT` | Render injects this automatically; you can leave it unset. |
| `NEXT_PUBLIC_APP_URL` | `https://kora-platform.onrender.com` (your Render service URL). Used for Open Graph/canonical URLs. |

### Optional / demo

| Variable | Value / Notes |
|----------|---------------|
| `KORA_DEMO_PASSWORD` | Set to `Demo@1234` to allow shared-password sign-in for seeded accounts. **Remove this in production.** |
| `MPESA_PAYBILL` | M-Pesa Buy Goods / Till number — customer pays SME for goods (displayed in checkout and onboarding status). |
| `MPESA_BUSINESS_NAME` | Display name for the platform paybill. |
| `TRON_FEE_WALLET` | TRON fee treasury address (platform fees per chain). |
| `SOLANA_FEE_WALLET` | Solana fee treasury address (platform fees per chain). |
| `TRON_DEPOSIT_WALLET` | TRON hot wallet for user deposits and withdrawal origins. |
| `SOLANA_DEPOSIT_WALLET` | Solana hot wallet for user deposits and withdrawal origins. |
| `NEXT_PUBLIC_TRON_FEE_WALLET` | Public frontend variant of TRON fee wallet. |
| `NEXT_PUBLIC_SOLANA_FEE_WALLET` | Public frontend variant of Solana fee wallet. |
| `NEXT_PUBLIC_TRON_DEPOSIT_WALLET` | Public frontend variant of TRON deposit wallet. |
| `NEXT_PUBLIC_SOLANA_DEPOSIT_WALLET` | Public frontend variant of Solana deposit wallet. |
| `KORA_ALLOW_DEMO_LOGIN` | Set to `true` only if you also want demo password login enabled in production. Leave empty/unset for production. |
| `DISBURSEMENT_PROVIDER` | `simulated` (default). Keep `simulated` until you have a licensed disbursement partner. Simulated loans write ledger entries flagged `simulated: true` and move no money. |
| `KORA_SEED_DEMO` | `true` to load the demo dataset on deploy. Set to `false` or remove for production. |
| `MPESA_ENVIRONMENT` | `sandbox` (default) or `production`. |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY` | Daraja credentials. Leave empty for sandbox simulation. |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | Optional. AI scoring/drafting fall back to local heuristics when unset. Lead sourcing needs a key. |
| `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Optional. Outbound sales emails default to simulated (no real mail sent). |


## Step 4 — Run Prisma migrations

Render does not run migrations automatically. You have two options:

### Option A: One-off render shell (recommended for first deploy)

1. In the Render dashboard, go to your web service → **Shell**.
2. Run:
   ```bash
   pnpm --filter @kora/database migrate:deploy
   ```
   This applies all migrations in `packages/database/prisma/migrations` to the Render Postgres database.

### Option B: Include in build

You can add a migration step to the build command, but it is safer to run migrations separately so a failed migration doesn't block deploys:

```
pnpm install && pnpm --filter @kora/database migrate:deploy && pnpm build
```


## Step 5 — Seed the demo dataset (optional)

If you set `KORA_SEED_DEMO=true`, run the seed once after migrations:

```bash
pnpm db:seed
```

This creates the demo accounts (admin, SMEs, suppliers, customers), products, sales history, loans, BNPL plans, and ledger entries.

Demo sign-in (password: `Demo@1234`):
- `admin@demo.kora.co.ke`
- `sme1@demo.kora.co.ke`
- `supplier1@demo.kora.co.ke`
- `customer1@demo.kora.co.ke`

> Only seed once. Re-running `db:seed` will attempt to recreate records and may fail on unique constraints.

## Step 6 — Verify the deployment

1. Open your Render service URL (e.g. `https://kora-platform.onrender.com`).
2. You should see the public landing page.
3. Sign in with a demo account to access the role-specific dashboards.
4. Test an API endpoint:
   ```bash
   curl https://kora-platform.onrender.com/api/auth/me
   ```
   (401 when unsigned in is expected.)


## Render-specific notes

### Port binding

Render requires the service to listen on `$PORT`. `scripts/dev.mjs` inherits `process.env` and forwards it to `next start`. If you set `PORT` explicitly in Render env vars, make sure it matches what Render expects — best to leave `PORT` unset and let Render inject it.

### Monorepo install

`pnpm install` at the repo root installs all workspace packages and creates the `@kora/*` symlinks in `apps/admin/node_modules`. The `prebuild` script runs `scripts/check-deps.mjs`, which verifies those links exist before `turbo run build` starts.

### Prisma client

The generated Prisma client (`packages/database/generated/client`) is committed in this repo, so `prisma generate` is not strictly required at build time. If you change the Prisma schema, run `pnpm db:generate` locally and commit the regenerated client before deploying.

### Disbursement safety gate

`DISBURSEMENT_PROVIDER` defaults to `simulated`. Loan disbursement writes balanced ledger entries flagged `simulated: true` and parks loans at `BLOCKED_NO_PARTNER` — no money moves. Do not set this to `partner` until you have a licensed Kenyan disbursement partner and compliance arrangements in place (CBK digital-credit perimeter).

### Demo password

`KORA_DEMO_PASSWORD` lets any seeded account sign in with one shared password. The app also requires `KORA_ALLOW_DEMO_LOGIN=true` in production before the shared password is honored. Remove both before going live.

## Optional: render.yaml

If you prefer infrastructure-as-code, create `render.yaml` at the repo root:

```yaml
services:
  - type: web
    name: kora-platform
    env: node
    region: ohio
    buildCommand: pnpm install && pnpm build
    startCommand: PORT=$PORT pnpm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: kora-db
          property: connectionString
      - key: DIRECT_URL
        fromDatabase:
          name: kora-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: JWT_SECRET
        generateValue: true
      - key: NEXT_PUBLIC_APP_URL
        value: https://kora-platform.onrender.com
      - key: DISBURSEMENT_PROVIDER
        value: simulated
      - key: KORA_SEED_DEMO
        value: "true"
      - key: MPESA_PAYBILL
        value: ""
      - key: MPESA_BUSINESS_NAME
        value: ""
      - key: TRON_FEE_WALLET
        value: ""
      - key: SOLANA_FEE_WALLET
        value: ""
      - key: TRON_DEPOSIT_WALLET
        value: ""
      - key: SOLANA_DEPOSIT_WALLET
        value: ""
      - key: NEXT_PUBLIC_TRON_FEE_WALLET
        value: ""
      - key: NEXT_PUBLIC_SOLANA_FEE_WALLET
        value: ""
      - key: NEXT_PUBLIC_TRON_DEPOSIT_WALLET
        value: ""
      - key: NEXT_PUBLIC_SOLANA_DEPOSIT_WALLET
        value: ""

databases:
  - name: kora-db
    plan: free
```

Then in Render: **Blueprint** → connect the repo → Render creates the database and web service from `render.yaml`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Build fails at `prebuild` | Missing `@kora/*` workspace links | Run `pnpm install` at root; ensure `pnpm-workspace.yaml` includes `packages/*` |
| `DATABASE_URL` not found on render | `.env` not loaded in production | Set `DATABASE_URL`/`DIRECT_URL` in Render env vars; next.config.mjs only loads root `.env` locally |
| Cookie forgeable / sign-in rejected | `SESSION_SECRET` is placeholder or < 32 chars | Set a real random `SESSION_SECRET` (>= 32 chars) |
| Loans never get disbursed | `DISBURSEMENT_PROVIDER=simulated` | Expected — simulated mode moves no money until a partner is configured |
| Migrations fail | Pooled connection used for DDL | Use `DIRECT_URL` (direct, non-pooled) for `migrate:deploy` |

## Security checklist before production

- [ ] `KORA_DEMO_PASSWORD` removed (and `KORA_ALLOW_DEMO_LOGIN` unset)
- [ ] `SESSION_SECRET` and `JWT_SECRET` are fresh random values, not placeholders
- [ ] Crypto fee treasury and deposit wallet addresses set for TRON and Solana (not placeholder)
- [ ] M-Pesa Buy Goods / Till (`MPESA_PAYBILL`, `MPESA_BUSINESS_NAME`) configured if live customer payments are needed
- [ ] `NEXT_PUBLIC_APP_URL` points at your real Render domain (no localhost)
- [ ] `DISBURSEMENT_PROVIDER=simulated` until a licensed partner is contracted
- [ ] Database credentials rotated if they ever appeared in a committed `.env`

