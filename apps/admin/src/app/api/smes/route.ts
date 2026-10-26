import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const smes = await prisma.sME.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      county: true,
      town: true,
      onboardingStatus: true,
      subscriptionStatus: true,
      subscriptionAmount: true,
      user: { select: { email: true, fullName: true, isActive: true } },
      _count: { select: { sales: true, products: true, loans: true } },
    },
  });

  return NextResponse.json(smes);
}

export async function POST(req: Request) {
  const auth = await withAuth("ADMIN");
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { businessName, businessType, county, town, address, mpesaTill, mpesaPaybill } = body;

  if (!businessName || typeof businessName !== "string") {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }

  const phone = `254${Math.floor(Math.random() * (99999999 - 10000000 + 1)) + 10000000}`;

  const sme = await prisma.sME.create({
    data: {
      businessName,
      businessType: businessType as string | null,
      county: county as string | null,
      town: town as string | null,
      address: address as string | null,
      mpesaTill: mpesaTill as string | null,
      mpesaPaybill: mpesaPaybill as string | null,
      user: {
        create: {
          authUserId: crypto.randomUUID(),
          email: `sme+${crypto.randomUUID()}@demo.kora.co.ke`,
          fullName: businessName,
          phone,
          role: "SME",
        },
      },
      products: {
        create: Array.from({ length: 5 }, (_, i) => ({
          name: `Product ${i + 1}`,
          description: `Description for product ${i + 1}`,
          sku: `PROD-${Date.now()}-${i}`,
          price: 100 + i * 10,
          costPrice: 50 + i * 5,
          stockQuantity: 10 + i,
        })),
      },
    },
    select: {
      id: true,
      businessName: true,
      businessType: true,
      county: true,
      town: true,
      mpesaTill: true,
      mpesaPaybill: true,
      user: { select: { email: true, fullName: true, isActive: true } },
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json(sme, { status: 201 });
}
