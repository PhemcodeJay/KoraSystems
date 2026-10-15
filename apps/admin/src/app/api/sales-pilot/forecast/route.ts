import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { forecastDemand } from "@kora/ai/commerce";
import { NextResponse } from "next/server";

const HISTORY_DAYS = 90;

export async function GET(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const requestedSmeId = new URL(request.url).searchParams.get("smeId");
  const smeId = scope.isAdmin ? requestedSmeId : scope.smeId;
  if (!smeId) {
    return NextResponse.json(
      { error: scope.isAdmin ? "smeId is required." : "No business is linked to this account." },
      { status: scope.isAdmin ? 400 : 403 },
    );
  }

  const now = new Date();
  const firstDay = new Date(now);
  firstDay.setUTCHours(0, 0, 0, 0);
  firstDay.setUTCDate(firstDay.getUTCDate() - HISTORY_DAYS + 1);
  const [products, items] = await Promise.all([
    prisma.product.findMany({
      where: { smeId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        reorderLevel: true,
        lowStockThreshold: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          smeId,
          soldAt: { gte: firstDay },
          paymentStatus: "COMPLETED",
        },
      },
      select: {
        productId: true,
        quantity: true,
        sale: { select: { soldAt: true } },
      },
    }),
  ]);

  const quantities = new Map<string, Map<string, number>>();
  for (const item of items) {
    const date = item.sale.soldAt.toISOString().slice(0, 10);
    const daily = quantities.get(item.productId) ?? new Map<string, number>();
    daily.set(date, (daily.get(date) ?? 0) + item.quantity);
    quantities.set(item.productId, daily);
  }

  const data = products.map((product) => {
    const daily = quantities.get(product.id) ?? new Map<string, number>();
    const observations = Array.from({ length: HISTORY_DAYS }, (_, offset) => {
      const date = new Date(firstDay.getTime() + offset * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      return { date, quantity: daily.get(key) ?? 0 };
    });
    const forecast = forecastDemand(
      observations,
      product.stockQuantity,
      product.reorderLevel || product.lowStockThreshold,
      now,
    );
    return { ...product, forecast };
  });

  return NextResponse.json({ data });
}
