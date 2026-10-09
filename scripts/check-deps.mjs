/**
 * Preflight: catch a damaged node_modules before it costs a failed build.
 *
 * Symptom this prevents: `next build` dies with
 *   Cannot find module '.../next/dist/compiled/jest-worker/processChild.js'
 * because pnpm left the package directory present but EMPTY. That only surfaces
 * at build time, after you have already waited out a build.
 *
 * Second symptom this prevents: a STALE generated Prisma client. When
 * schema.prisma gains a model and `prisma generate` has not been rerun, every
 * use of the new model fails to typecheck — `Prisma has no exported member
 * 'ReceiptWhereInput'` — and each untyped callback it drags along surfaces as
 * a cascade of `TS7006: Parameter 'x' implicitly has an 'any' type`, which
 * reads like dozens of unrelated code errors rather than one stale artefact.
 *
 * Run:  node scripts/check-deps.mjs
 * Exits non-zero if a package directory has no files in it, or if the Prisma
 * client is older than the schema.
 *
 * ── Reading pnpm's virtual store ──────────────────────────────────────────
 * Each entry is named `<name>@<version>`, where a scoped name keeps its `@`
 * and its `/` becomes `+`:
 *     next@14.2.35_...            → node_modules/next/
 *     @babel+core@7.29.7          → node_modules/@babel/core/
 * Inside, node_modules also holds that package's own dependencies, so the
 * package of interest is identified BY NAME — never by "the first directory",
 * which would pick a transitive dep instead.
 */

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const virtualStore = join(root, "node_modules", ".pnpm");

if (!existsSync(virtualStore)) {
  console.error("node_modules/.pnpm is missing. Run: pnpm install --force");
  process.exit(1);
}

/**
 * Recover the package name from a virtual-store entry directory name.
 *
 * Entries look like:
 *     next@14.2.35
 *     @babel+core@7.29.7
 *     @babel+helper-x@7.29.7_@babel+core@7.29.7   ← peer-dependency suffix
 *
 * The version is the FIRST `@` that follows the name, because the peer suffix
 * itself contains further `@` characters. Using lastIndexOf would return the
 * peer package and flag ~163 healthy packages as empty.
 */
function packageNameOf(entry) {
  const at = entry.indexOf("@", 1);
  if (at <= 0) return null;
  return entry.slice(0, at).replace("+", "/");
}

/** The directory holding the entry's own package, or null if absent. */
function packageDirOf(entry) {
  const name = packageNameOf(entry);
  if (!name) return null;
  const nm = join(virtualStore, entry, "node_modules");
  const scoped = name.startsWith("@");
  return scoped ? join(nm, ...name.split("/")) : join(nm, name);
}

/** True when the tree holds at least one file. */
function hasFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const e of entries) {
    try {
      const s = statSync(join(dir, e));
      if (s.isFile()) return true;
      if (s.isDirectory() && hasFiles(join(dir, e))) return true;
    } catch {
      // Vanished mid-scan.
    }
  }
  return false;
}

const empty = [];
let checked = 0;

for (const entry of readdirSync(virtualStore)) {
  const pkgDir = packageDirOf(entry);
  if (!pkgDir) continue;
  checked++;

  // The wiped case: the directory exists but holds nothing. A missing
  // package.json is the reliable signal — it cannot be fooled by a package
  // that legitimately ships very few files.
  if (!existsSync(join(pkgDir, "package.json")) || !hasFiles(pkgDir)) {
    empty.push(entry);
  }
}

if (empty.length === 0) {
  console.log(`node_modules OK — ${checked} packages checked, none empty.`);
} else {
  console.error(
    `\nFound ${empty.length} empty package director${empty.length === 1 ? "y" : "ies"} of ${checked}:`,
  );
  for (const e of empty.slice(0, 20)) console.error(`  - ${e}`);
  if (empty.length > 20) console.error(`  ... and ${empty.length - 20} more`);
  console.error(
    "\npnpm left these present but empty (Windows EPERM during install).\n" +
      "Fix: stop dev servers, then run  pnpm install --force\n" +
      "(.npmrc now sets package-import-method=copy so this should not recur).",
  );
  process.exit(1);
}

/**
 * Stale Prisma client: every `model X` in schema.prisma must have a matching
 * `XWhereInput` in the generated client. Comparing model names is cheaper and
 * far more readable than a mtime comparison, and it names the missing model.
 */
const schemaPath = join(root, "packages", "database", "prisma", "schema.prisma");
if (existsSync(schemaPath)) {
  const schema = readFileSync(schemaPath, "utf8");
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

  // The generated client lives in the pnpm store path, not the repo.
  const clientDir = join(
    virtualStore,
    readdirSync(virtualStore).find((e) => e.startsWith("@prisma+client@")) ?? "",
    "node_modules",
    ".prisma",
    "client",
  );
  const dts = join(clientDir, "index.d.ts");

  if (!existsSync(dts)) {
    console.error(
      "\nPrisma client is not generated (.prisma/client/index.d.ts missing).\n" +
        "Fix: pnpm db:generate",
    );
    process.exit(1);
  }

  const generated = readFileSync(dts, "utf8");
  const missing = models.filter((m) => !generated.includes(`export type ${m}WhereInput`));
  if (missing.length > 0) {
    console.error(
      `\nPrisma client is STALE — ${missing.length} model(s) in schema.prisma are not in the generated client:`,
    );
    for (const m of missing.slice(0, 20)) console.error(`  - ${m}`);
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
    console.error(
      "\nThis surfaces as `Prisma has no exported member '<Model>WhereInput'` plus a\n" +
        "cascade of TS7006 implicit-any errors. Fix: pnpm db:generate",
    );
    process.exit(1);
  }
  console.log(`Prisma client OK — ${models.length} models generated.`);
}

