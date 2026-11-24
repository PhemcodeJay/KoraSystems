# Contributing to KoraSystems

Thank you for wanting to contribute! This guide helps you get set up and follow the project's conventions.

## 🛠️ Development Environment

1. **Install prerequisites**
   - [Node.js](https://nodejs.org/) ≥ 20
   - [pnpm](https://pnpm.io/) 9.15.9 (pinned in root `package.json`)
   - `corepack enable` if using the Node.js shim

2. **Clone & install**
   ```bash
   git clone https://github.com/PhemcodeJay/KoraSystems.git
   cd KoraSystems
   pnpm install
   ```

3. **Run the setup script** (automates the above)
   ```bash
   pnpm scripts/setup.sh
   ```

4. **Environment variables**
   - Copy `.env.example` to `.env`
   - Fill in real values for `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `JWT_SECRET`
   - **Never** commit `.env`; it is covered by `.gitignore`

5. **Local development**
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:5000` (port configured in `.env`).

## 📦 Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all workspace dependencies |
| `pnpm dev` | Start the Next.js development server |
| `pnpm build` | Build the entire workspace |
| `pnpm typecheck` | Run TypeScript type checking on all packages |
| `pnpm lint` | Run ESLint on the workspace |
| `pnpm check:deps` | Verify that all workspace packages and critical deps are present |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Load demo data |
| `pnpm db:rescore` | Re‑compute credit assessments |

## 🧪 Testing

- **Unit tests** live inside each package under `__tests__/`. Run with `pnpm test` (per‑package script).
- **Integration / E2E** tests are under `apps/admin/__tests__/`. Use a temporary PostgreSQL container if you need a full DB spin‑up.
- Before opening a PR, ensure `pnpm typecheck` and `pnpm lint` pass.

## 📥 Pull Request Process

1. **Branch** from `main` (or `develop` for feature work) and give your branch a descriptive name, e.g. `feat/mpesa-production-ready`.
2. **Commit** using conventional commits (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`).
3. **Run the CI pipeline** locally: `pnpm lint && pnpm typecheck && pnpm build && pnpm check:deps`.
4. **Add or update tests** for any new functionality or bug fixes.
5. **Update documentation** (`README.md`, `docs/`, inline JSDoc) if the change affects users or configuration.
6. **Open a PR** against `main` with a clear title and description. Fill the PR template (if your fork has one).
7. **Address reviewer feedback** and re‑run the CI pipeline.

## 📚 Coding Style

- Use TypeScript with `strict: true` (enforced by the root `turbo.json`).
- Follow the existing ESLint config (airbnb-base with Kora overrides).
- Keep functions small and pure where possible.
- Add JSDoc for public APIs.
- Prefer workspace packages (`workspace:*`) over external copies.

## 🚀 Deploying

- The monorepo is configured for Vercel (see `apps/admin/vercel.json`).
- Ensure all required environment variables are set in the Vercel project dashboard.
- Run `pnpm build` locally before pushing; Vercel will rebuild on push.
- After merge to `main`, Vercel triggers a production deployment.

## 🙏 Questions?

- Open a discussion or tag a maintainer.
- Check the [roadmap](./README.md#roadmap) for upcoming items.

Thank you for helping make KoraSystems better!