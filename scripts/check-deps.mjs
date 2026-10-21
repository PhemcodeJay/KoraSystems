/**
 * Prebuild dependency verification.
 *
 * Confirms `pnpm install` has run and that every workspace package the admin
 * app depends on is present and resolvable. Runs as `prebuild` so a broken or
 * incomplete install surfaces here rather than deep inside `turbo run build`.
 *
 * Exit non-zero if any expected package is missing.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps", "admin");

// Workspace packages the admin app imports directly.
const workspacePackages = [
  "@kora/ai",
  "@kora/auth",
  "@kora/brand",
  "@kora/database",
  "@kora/disbursement",
  "@kora/ledger",
];

// Critical runtime dependencies that must be installed for Next to boot.
const criticalDeps = ["next", "react", "react-dom"];

let missing = [];

for (const name of workspacePackages) {
  const p = join(app, "node_modules", name);
  if (!existsSync(p)) missing.push(name);
}

for (const name of criticalDeps) {
  const p = join(app, "node_modules", name);
  if (!existsSync(p)) missing.push(name);
}

if (missing.length) {
  console.error("check:deps: FAILED — missing dependencies:");
  for (const name of missing) console.error(`  - ${name}`);
  console.error("\nRun `pnpm install` to restore workspace links, then retry.");
  process.exit(1);
}

// ── Demo-password safety checks (production) ───────────────────────────────
// The demo password is a shared secret that opens every seeded account. In
// production it is harmless only if `KORA_ALLOW_DEMO_LOGIN` is also "true" —
// which is easy to forget when copying a demo .env onto a production host.
// Surface this early (prebuild) rather than deep in a request path.
const demoPassword = process.env.KORA_DEMO_PASSWORD ?? "";
const allowDemoLogin = process.env.KORA_ALLOW_DEMO_LOGIN ?? "";
if (
  process.env.NODE_ENV === "production" &&
  demoPassword &&
  allowDemoLogin !== "true"
) {
  console.warn(
    "check:deps: WARN — KORA_DEMO_PASSWORD is set in production without " +
      "KORA_ALLOW_DEMO_LOGIN=true. In production the shared password is ignored, " +
      "so this is effectively dead config. To use the demo seed set " +
      "KORA_ALLOW_DEMO_LOGIN=true; to go live, remove KORA_DEMO_PASSWORD.",
  );
}
console.log(
  `check:deps: OK — ${workspacePackages.length} workspace packages and ${criticalDeps.length} critical deps present.`
);
process.exit(0);
