import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Low-stock catalogue.
 *
 * Returns products whose stockQuantity is at or below their reorder threshold,
 * scoped to the caller's business (SME sees only its own; ADMIN sees all).
 * Shape matches the LowStockItem type used by the POS page:
 * { id, name, sku, stockQuantity, reorderLevel }.
 */
export async function GET(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const where: Record<string, unknown> = {
    isActive: true,
  };
  if (!scope.isAdmin) {
    where.smeId = scope.smeId ?? "__none__";
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { stockQuantity: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      lowStockThreshold: true,
    },
  });

  // Prisma cannot compare two columns in a where clause, so filter here:
  // a product is low-stock when its quantity is at or below its threshold.
  const data = products
    .filter((p) => p.lowStockThreshold !== null && p.stockQuantity <= p.lowStockThreshold)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stockQuantity: p.stockQuantity,
      reorderLevel: p.lowStockThreshold ?? null,
    }));

  return NextResponse.json(data);
}
