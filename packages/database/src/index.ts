import { PrismaClient } from "../generated/client";

/**
 * Re-exported so consumers can type query filters precisely, e.g.
 * `const where: Prisma.RefundWhereInput = ...`. Typed `where` clauses are what
 * let the compiler catch a scoping filter aimed at the wrong relation.
 */
export { Prisma } from "../generated/client";
export { scoreSmeCredit } from "./credit-score";

/**
 * Single shared Prisma client.
 *
 * Cached on globalThis so Next.js hot-reload does not open a new pool on
 * every module evaluation. Neon is a pooled host, so keep `max` small.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build a datasource URL that caps the PostgreSQL connection pool via the
 * libpq `connection_limit` parameter. Neon's free/hobby plans cap concurrent
 * connections, so without an explicit limit the driver can exhaust them and
 * every query fails with "PostgreSQL connection: Closed".
 *
 * PRISMA_CONNECTION_LIMIT defaults to 5 in dev, 10 in production.
 * PRISMA_POOL_TIMEOUT_MS is not a libpq parameter; it is documented in .env
 * for operators but enforced at the application layer (query timeouts).
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  const limit =
    process.env.PRISMA_CONNECTION_LIMIT ??
    (process.env.NODE_ENV === "production" ? "10" : "5");

  // Strip any existing connection_limit so we don't duplicate it.
  const base = raw.replace(/[?&]connection_limit=\d+/, "");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}connection_limit=${limit}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
    datasources: {
      db: {
        url: datasourceUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
