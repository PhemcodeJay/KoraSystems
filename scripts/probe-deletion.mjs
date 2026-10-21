/**
 * Diagnostic: find out WHAT removes files from node_modules mid-build.
 *
 * Symptom: pnpm install reports success, `node scripts/check-deps.mjs` passes,
 * and then the very next turbo build dies with MODULE_NOT_FOUND for packages
 * that were present seconds earlier (react, next/dist/build/webpack-build).
 *
 * Method: drop a uniquely-named marker file into several package directories,
 * record a full file census, run whatever command you pass in, then diff.
 * A marker that disappears names the directory that got cleaned.
 *
 * Run:  node scripts/probe-deletion.mjs -- <command> [args...]
 */

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const marker = `PROBE_${process.pid}_${Date.now()}`;

/** Directories to instrument: one per layer that gets wiped in practice. */
const targets = [
  "node_modules/.pnpm/react@18.3.1/node_modules/react",
  "node_modules/.pnpm/next@14.2.35_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/build",
  "node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom",
  "node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler",
];

const argv = process.argv.slice(2).filter((a) => a !== "--");
if (argv.length === 0) {
  console.error("usage: node scripts/probe-deletion.mjs -- <command> [args...]");
  process.exit(2);
}

function census() {
  const out = {};
  for (const t of targets) {
    const dir = join(root, t);
    let n = 0;
    const walk = (d) => {
      let entries;
      try {
        entries = readdirSync(d);
      } catch {
        return;
      }
      for (const e of entries) {
        try {
          if (statSync(join(d, e)).isDirectory()) walk(join(d, e));
          else n++;
        } catch {
          /* vanished */
        }
      }
    };
    walk(dir);
    out[t] = { files: n, marker: existsSync(join(dir, marker)) };
  }
  return out;
}

for (const t of targets) {
  const dir = join(root, t);
  if (existsSync(dir)) writeFileSync(join(dir, marker), "keep\n");
}

const before = census();
console.log("BEFORE");
for (const [t, v] of Object.entries(before)) console.log(`  ${v.files} files  ${t}`);

console.log(`\nRUN: ${argv.join(" ")}\n`);
const started = Date.now();
const res = spawnSync(argv[0], argv.slice(1), {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

const after = census();
console.log(`\nAFTER (exit ${res.status}, ${elapsed}s)`);
for (const [t, v] of Object.entries(after)) {
  const delta = v.files - before[t].files;
  const verdict = !v.marker
    ? "MARKER DELETED — this directory was cleaned during the run"
    : delta < 0
      ? `${delta} files removed, marker kept`
      : "intact";
  console.log(`  ${v.files} files (${delta >= 0 ? "+" : ""}${delta})  ${verdict}  ${t}`);
}

process.exit(res.status ?? 1);
