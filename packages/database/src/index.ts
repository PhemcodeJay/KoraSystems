import { PrismaClient } from "@prisma/client";

/**
 * Re-exported so consumers can type query filters precisely, e.g.
 * `const where: Prisma.RefundWhereInput = ...`. Typed `where` clauses are what
 * let the compiler catch a scoping filter aimed at the wrong relation.
 */
export { Prisma } from "@prisma/client";

/**
 * Single shared Prisma client.
 *
 * Cached on globalThis so Next.js hot-reload does not open a new pool on
 * every module evaluation. Neon is a pooled host, so keep `max` small.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
