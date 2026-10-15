import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { writeFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma's `defineConfig` API does not auto-load `.env` files, but `schema.prisma`
// reads DATABASE_URL / DIRECT_URL from it. Load the repo-root `.env` explicitly so
// `pnpm db:migrate` / `pnpm db:seed` work from the repo root (same pattern as
// `apps/admin/next.config.mjs`).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.join(__dirname, "..", "..", ".env");
if (process.loadEnvFile) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // Missing or malformed .env is surfaced later where the vars are actually read.
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
