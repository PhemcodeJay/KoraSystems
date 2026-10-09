import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Every business on the platform, with its linked account and counts.
 *
 * Platform-wide by nature, so this is ADMIN-only. The dashboard reads
 * `.length`, and the response is a bare array to match /api/sales and the
 * other list routes it reads alongside this one.
 */
export async function GET() {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const smes = await prisma.sME.findMany({
    orderBy: { businessName: "asc" },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      county: true,
      town: true,
      onboardingStatus: true,
      subscriptionStatus: true,
      subscriptionAmount: true,
      createdAt: true,
      user: { select: { email: true, fullName: true, isActive: true } },
      _count: { select: { products: true, sales: true, loans: true } },
    },
  });

  return NextResponse.json(smes);
}
