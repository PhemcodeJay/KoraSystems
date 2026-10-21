import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

/**
 * Active products.
 *
 * Read access for the storefront and for SMEs managing their own catalogue.
 * Public-by-role: an unauthenticated visitor is rejected, but any signed-in
 * role may browse the catalogue — only writes are SME/ADMIN.
 *
 * An SME sees only its own products; a supplier sees the products it supplies;
 * an admin sees the platform catalogue.
 */
export async function GET(request: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN", "SUPPLIER", "CUSTOMER");

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim();

  const filters: Record<string, unknown>[] = [{ isActive: true }];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (!scope.isAdmin) {
    if (scope.smeId) filters.push({ smeId: scope.smeId });
    else if (scope.supplierId) filters.push({ supplierId: scope.supplierId });
    // A CUSTOMER falls through with no tenant filter, which returns the whole
    // active catalogue — correct for a storefront, and necessary now that the
    // shop lives in this app. Prices are public catalogue data, not another
    // tenant's records; the sale itself is still scoped at /api/checkout.
  }

  const products = await prisma.product.findMany({
    where: { AND: filters },
    orderBy: { name: "asc" },
    take: 100,
  });

  return NextResponse.json({ data: products });
}

/**
 * Create a product in the caller's own catalogue.
 *
 * This is what the onboarding wizard's "first product" step posts to. Only
 * writes are SME/ADMIN — see GET above — and `smeId` comes from the session,
 * never the body, so a business can only list stock against itself.
 */
export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  if (!scope.isAdmin && !scope.smeId) {
    return NextResponse.json(
      { error: "No business is linked to this account." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    sku?: unknown;
    price?: unknown;
    stockQuantity?: unknown;
    category?: unknown;
    costPrice?: unknown;
    lowStockThreshold?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const sku = typeof body?.sku === "string" ? body.sku.trim() : "";
  const price = Number(body?.price);
  const stock = Number(body?.stockQuantity ?? 0);

  if (!name) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }
  if (!sku) {
    return NextResponse.json({ error: "SKU is required." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "Price must be zero or more." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return NextResponse.json(
      { error: "Stock quantity must be a whole number." },
      { status: 400 },
    );
  }

  const clash = await prisma.product.findUnique({ where: { sku } });
  if (clash) {
    return NextResponse.json(
      { error: "That SKU is already in use." },
      { status: 409 },
    );
  }

  const costPrice = body?.costPrice === undefined ? null : Number(body.costPrice);
  const threshold = Number(body?.lowStockThreshold ?? 10);

  // An admin creates on behalf of a named business; without one, refuse rather
  // than let Prisma fail on an empty foreign key.
  let smeId = scope.smeId;
  if (scope.isAdmin) {
    smeId = typeof (body as { smeId?: unknown })?.smeId === "string"
      ? ((body as { smeId?: string }).smeId as string)
      : undefined;
    if (!smeId) {
      return NextResponse.json(
        { error: "smeId is required when creating a product as an admin." },
        { status: 400 },
      );
    }
  }

  // SaaS product cap: enforced best-effort so pre-migration DBs keep working.
  // When the tenant tables exist, a tenant at its cap gets a 402 naming the
  // upgrade tier instead of a silent extra product.
  if (smeId && !scope.isAdmin) {
    try {
      const { getTenantSubscription } = await import("@kora/auth/tenant-billing");
      const { limitExceeded } = await import("@kora/auth/tenant-usage");
      const sub = await getTenantSubscription(prisma, smeId);
      const used = await prisma.product.count({ where: { smeId, isActive: true } });
      const check = limitExceeded(sub.tier, "products", used);
      if (!check.ok) {
        return NextResponse.json(
          { error: check.error, limit: check.limit, used: check.used, upgradeTo: check.upgradeTo },
          { status: 402 },
        );
      }
    } catch {
      // Tenant tables missing — skip the cap, keep the write working.
    }
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        smeId: smeId!,
        name,
        sku,
        price,
        stockQuantity: stock,
        category:
          typeof body?.category === "string" && body.category.trim()
            ? body.category.trim()
            : null,
        costPrice: costPrice !== null && Number.isFinite(costPrice) ? costPrice : null,
        lowStockThreshold:
          Number.isInteger(threshold) && threshold >= 0 ? threshold : 10,
      },
    });

    if (!scope.isAdmin && smeId) {
      await tx.sME.updateMany({
        where: {
          id: smeId,
          onboardingStep: "PRODUCTS",
          onboardingStatus: "IN_PROGRESS",
        },
        data: { onboardingStep: "PAYMENTS" },
      });
    }
    return created;
  });

  return NextResponse.json({ data: product }, { status: 201 });
}
