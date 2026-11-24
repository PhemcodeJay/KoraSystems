# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec.html).

## [Unreleased]

### Added
- Security hardening: demo password placeholder removed from `.env.example`; secrets now required.
- CI pipeline: GitHub Actions workflow `.github/workflows/ci.yml` adding lint, typecheck, build, and `check:deps` jobs.
- Developer onboarding: `scripts/setup.sh` to automate environment setup.
- Turbo configuration: updated `turbo.json` with global dependencies, caching, and Node options.
- Ledger reconciliation endpoint: `GET /api/ledger/reconcile` provides daily posting summaries and asset net balances.
- Contributing guide: new `CONTRIBUTING.md` with dev environment, PR process, and coding standards.
- Changelog: new `CHANGELOG.md` to track releases.

### Changed
- Moved `KORA_DEMO_PASSWORD` and `KORA_ALLOW_DEMO_LOGIN` to commented-out placeholders in `.env.example`.
- Updated `.env.example` comments to warn against sharing demo credentials in production.

### Fixed
- Corrected placeholder `SESSION_SECRET` and `JWT_SECRET` guidance (now generated via `openssl rand -base64 48`).
- Ensured `MPESA_C2B_VERIFY_SIGNATURES` defaults to `false` and requires `MPESA_C2B_SECRET` when enabled.

## [0.1.0] – 2026-11-24

Initial release of the KoraSystems monorepo with core packages:
 messenger, auth, database, ledger, disbursement, ai, and the admin Next.js app.