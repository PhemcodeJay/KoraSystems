/**
 * Start the platform.
 *
 * ── Why this is not just `turbo run dev` ──────────────────────────────────
 * turbo delegates each package's script back to the package manager, and this
 * machine has no `pnpm` on PATH — `corepack enable` cannot fix that without
 * admin rights to write the shim into Program Files. The result is a confusing
 * "Unable to find package manager binary" failure that has nothing to do with
 * the app. Spawning Next directly removes that whole dependency chain.
 *
 * ── Why this is not a one-liner in package.json ───────────────────────────
 * Next resolves `next.config.mjs` and `tsconfig.json` from the process working
 * directory, so the command has to run from `apps/admin`. `cd a && b` is not
 * portable between cmd.exe and sh, so it cannot be expressed in a script string.
 *
 * Args are forwarded, so `node scripts/dev.mjs start` runs the production
 * server. `PORT` is inherited, so `PORT=4000 npm run dev` still moves the app.
 *
 * ── Turbopack ──────────────────────────────────────────────────────────────
 * Pass `--turbo` as a flag to use Next's Rust-based compiler instead of
 * webpack. Dev startup and hot reload are typically 2-5x faster:
 *
 *   PORT=5000 node scripts/dev.mjs dev --turbo
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps", "admin");
const nextBin = join(app, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  console.error(
    `Next.js is not installed at:\n  ${nextBin}\n\nInstall dependencies first:\n  npm install    (or pnpm install)`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: app,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  // A signal-terminated child reports a null code; surface that as a failure
  // rather than letting a killed server look like a clean shutdown.
  process.exit(signal ? 1 : (code ?? 0));
});

child.on("error", (err) => {
  console.error("Could not start Next.js:", err.message);
  process.exit(1);
});