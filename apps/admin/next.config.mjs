import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

// Load the repo-root `.env` before anything reads process.env.
//
// The documented env file lives at the REPO ROOT (README: `cp .env.example
// .env`), but Next resolves `.env` from THIS app's directory. Without this the
// app boots, binds its port, and then every server render throws
// `Environment variable not found: DATABASE_URL` — a failure that looks like a
// database problem rather than a config-loading one.
//
// `process.loadEnvFile` is built into Node (>=20.12), so this costs no
// dependency. It does not overwrite variables already in the environment, which
// is what you want: an explicit `DATABASE_URL=... pnpm dev` still wins over the
// file. If the file is malformed it is skipped rather than fatal — the operator
// gets a clear "variable not found" naming the culprit, instead of a boot that
// dies before the port is ever bound.
const rootEnv = join(repoRoot, ".env");
if (existsSync(rootEnv) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // Fall through; the missing variable surfaces where it is actually read.
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: `output: "standalone"` was removed. On Windows dev machines without
  // Developer Mode / elevated rights, Next's standalone trace-copy fails with
  // EPERM symlink errors and aborts an otherwise successful build. If a minimal
  // Docker image is needed, re-enable via `output: process.env.STANDALONE ? "standalone" : undefined`.
  // Workspace packages ship raw TypeScript; transpile them with the app.
  transpilePackages: ["@kora/ai", "@kora/brand", "@kora/ledger", "@kora/disbursement"],

  experimental: {
    /**
     * Keep Prisma out of the server bundle.
     *
     * `@prisma/client` resolves its native query engine by looking next to
     * itself on disk. When webpack inlines it into `.next/server`, that
     * lookup starts from the build output directory instead of
     * `node_modules`, so it fails with
     * "Prisma Client could not locate the Query Engine for runtime windows"
     * on every query. Externalising it leaves a runtime `require()` that
     * resolves through the real package path.
     *
     * `@kora/database` is the workspace wrapper around the client and is
     * listed for the same reason: it must not be flattened into the bundle.
     */
    serverComponentsExternalPackages: ["@prisma/client", "@kora/database"],
  },

  /**
   * Absolute origin for Open Graph / Twitter card URLs.
   *
   * Without this Next logs a warning on every render and falls back to
   * http://localhost:3000, so shared links on social platforms resolve to
   * localhost. Set NEXT_PUBLIC_APP_URL in production.
   *
   * The default is derived from PORT rather than repeated literally, because
   * this app is the platform's single origin: it serves SalesPilot, SwiftPOS,
   * Neobank, the admin console and the user dashboard on one port. A literal
   * port here that disagrees with the one the server actually binds produces
   * canonical URLs pointing at a port nobody is listening on.
   */
  env: {
    // Falls back to localhost only when unset, which is dev.
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ??
      `http://localhost:${process.env.PORT ?? "3000"}`,
  },

  async headers() {
    // `unsafe-eval` is required by React in development only. Allowing it in
    // production would defeat the point of the CSP, so it is gated on NODE_ENV.
    const scriptSrc =
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'";

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // This app serves only its own assets and the API; nothing is
          // loaded from a third-party origin.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        // The session cookie is httpOnly; never let a proxy or CDN store it.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
