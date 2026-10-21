import { prisma } from "@kora/database";
import { requireSme } from "@kora/auth/guards";
import { NextResponse } from "next/server";

/**
 * Edit and retire a single product.
 *
 * ── Why DELETE deactivates instead of deleting ─────────────────────────────
 * A product referenced by a `SaleItem` cannot be removed: the FK is
 * `onDelete: Restrict`, and even if it were not, deleting it would rewrite the
 * history of every sale it appears in. So "delete" flips `isActive` and takes
 * the product out of the till and the stock list while leaving every historical
 * sale intact and priced.
 *
 * A product that has never been sold has no history to protect, so it is
 * removed outright — otherwise a mis-typed product would sit in the catalogue
 * forever as an invisible row.
 *
 * Every write is scoped through `requireSme`, so one business cannot edit or
 * retire another's stock by guessing an id.
 */
type Params = { params: { id: string } };

const asNumber = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : Number(v));

export async function GET(_request: Request, { params }: Params) {
  const { sme } = await requireSme();

  const product = await prisma.product.findFirst({
    where: { id: params.id, smeId: sme.id },
    select: {
      id: true, name: true, description: true, sku: true, barcode: true,
      category: true, price: true, costPrice: true, stockQuantity: true,
      lowStockThreshold: true, reorderLevel: true, isActive: true,
    },
  });

  if (!product) return NextResponse.json({ error: "No such product." }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, { params }: Params) {
  const { sme } = await requireSme();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Product name is too short." }, { status: 400 });
    }
    data.name = name;
  }

  if (body.description !== undefined) data.description = String(body.description).trim() || null;
  if (body.category !== undefined) data.category = String(body.category).trim() || null;

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Price must be zero or more." }, { status: 400 });
    }
    data.price = price;
  }

  if (body.costPrice !== undefined) {
    const cost = asNumber(body.costPrice);
    data.costPrice = cost === null || (cost !== undefined && (!Number.isFinite(cost) || cost < 0))
      ? null
      : cost;
  }

  // Stock is deliberately NOT settable here. It moves through
  // `POST /api/inventory/adjust`, which writes a StockAdjustment row for audit.
  // Allowing a raw write here would change stock with no record of who did it.

  const threshold = asNumber(body.lowStockThreshold ?? body.reorderLevel);
  if (threshold !== undefined) {
    if (!Number.isInteger(threshold) || threshold < 0) {
      return NextResponse.json({ error: "Reorder level must be zero or more." }, { status: 400 });
    }
    data.lowStockThreshold = threshold;
    data.reorderLevel = threshold;
  }

  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, price: true, stockQuantity: true, isActive: true },
    });
    return NextResponse.json({ product });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2025") return NextResponse.json({ error: "No such product." }, { status: 404 });
    // P2002 = unique violation on sku or barcode.
    if (code === "P2002") {
      return NextResponse.json({ error: "That SKU or barcode is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not update the product." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { sme } = await requireSme();

  const product = await prisma.product.findFirst({
    where: { id: params.id, smeId: sme.id },
    select: {
      id: true,
      name: true,
      _count: { select: { saleItems: true, orderItems: true, invoiceItems: true } },
    },
  });

  if (!product) return NextResponse.json({ error: "No such product." }, { status: 404 });

  const used = product._count.saleItems + product._count.orderItems + product._count.invoiceItems;

  // Never sold, never ordered, never invoiced: remove it for real.
  if (used === 0) {
    await prisma.product.delete({ where: { id: product.id } });
    return NextResponse.json({ ok: true, mode: "deleted", name: product.name });
  }

  // Has history: retire it so it leaves the till but keeps every past sale
  // readable and correctly priced.
  await prisma.product.update({
    where: { id: product.id },
    data: { isActive: false },
  });

  return NextResponse.json({
    ok: true,
    mode: "retired",
    name: product.name,
    usedIn: used,
    message:
      "This product appears in existing records, so it was retired rather than deleted. It no longer shows in the till, and its sales history is unchanged.",
  });
}