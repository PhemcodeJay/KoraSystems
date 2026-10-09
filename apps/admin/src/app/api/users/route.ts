import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Every account on the platform, for the admin user console.
 *
 * ADMIN-only, and the `select` is exhaustive on purpose: it names every field
 * that leaves the server. `passwordHash` is absent, so it cannot be serialised
 * even by accident — the column holds a salted scrypt digest, which is a
 * password-equivalent secret and must never cross the wire. Adding a field
 * here is a deliberate act; that is the point.
 *
 * Granted roles come from `roleAssignments` filtered on `revokedAt`, so the
 * console can show which roles an account can *currently* act in rather than
 * which it once held.
 */
export async function GET(request: Request) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const role = url.searchParams.get("role") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const tier = url.searchParams.get("tier") ?? "";
  const take = Math.min(Number(url.searchParams.get("take") ?? 100) || 100, 500);
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0) || 0, 0);

  // Narrow in the database rather than filtering in JS: the admin console must
  // paginate a 71-row demo dataset and a 71,000-row production one with the
  // same code, and fetching everything to filter client-side would defeat the
  // `take`/`skip` an admin expects when they page through.
  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (status) where.isActive = status === "active";
  if (query) {
    where.OR = [
      { email: { contains: query, mode: "insensitive" } },
      { fullName: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { sme: { businessName: { contains: query, mode: "insensitive" } } },
      { supplier: { companyName: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (tier) where.plan = { tier };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        // Granted roles, live only. Revoked rows stay in the table for audit
        // but are not access.
        roleAssignments: {
          where: { revokedAt: null },
          select: { role: true, grantedVia: true, grantedAt: true },
        },
        plan: { select: { tier: true, status: true, cycle: true, amount: true } },
        sme: { select: { id: true, businessName: true } },
        supplier: { select: { id: true, companyName: true } },
        customer: { select: { id: true, fullName: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, take, skip });
}
