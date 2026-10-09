/**
 * Watcher: record when files vanish from a package directory, timestamped.
 *
 * Used alongside a parallel turbo build to answer "when does the wipe happen",
 * which the before/after probe cannot: a before/after diff only proves the
 * files were gone at the end.
 *
 * Run:  node scripts/watch-wipe.mjs <seconds> [packageDirRelativeToRoot]
 * Prints one line per observed change with an elapsed timestamp.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const seconds = Number(process.argv[2] ?? 60);
const rel = process.argv[3] ?? "node_modules/.pnpm/react@18.3.1/node_modules/react";
const dir = join(root, rel);

function count() {
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
        /* vanished mid-walk */
      }
    }
  };
  walk(dir);
  return n;
}

console.log(`watching ${rel} for ${seconds}s`);
const t0 = Date.now();
let prev = count();
console.log(`t=0.0s files=${prev}`);

const timer = setInterval(() => {
  const now = count();
  const t = ((Date.now() - t0) / 1000).toFixed(1);
  if (now !== prev) {
    console.log(`t=${t}s files=${now} (${now - prev >= 0 ? "+" : ""}${now - prev}) exists=${existsSync(dir)}`);
    prev = now;
  }
  if (Date.now() - t0 > seconds * 1000) {
    clearInterval(timer);
    console.log(`done, final files=${count()}`);
  }
}, 500);
