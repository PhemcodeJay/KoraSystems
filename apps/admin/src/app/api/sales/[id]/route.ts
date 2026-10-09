import { prisma } from "@kora/database";
import { requireSme } from "@kora/auth/guards";
import { NextResponse } from "next/server";

/**
 * Read and void a single sale.
 *
 * ── Why DELETE voids instead of removing the row ───────────────────────────
 * A sale is a financial record: it has ledger legs posted against it, a
 * platform fee taken and a stock movement applied. Deleting the row would leave
 * orphaned ledger entries and silently change every historical revenue figure
 * and forecast the platform has ever computed.
 *
 * So "delete" reverses it: `paymentStatus` becomes `REVERSED` and the stock is
 * put back, inside one transaction so a sale can never be marked reversed
 * without its stock also returning. The row stays, so the audit trail keeps the
 * original sale and shows what was done to it.
 *
 * This is deliberately different from a Refund, which returns money to a
 * customer for a sale that was legitimate. Voiding is for a sale that should
 * never have been recorded at all.
 */
type Params = { params: { id: string } };

const REVERSIBLE = ["PENDING", "COMPLETED"];

export async function GET(_request: Request, { params }: Params) {
  const { sme } = await requireSme();

  const sale = await prisma.sale.findFirst({
    where: { id: params.id, smeId: sme.id },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, stockQuantity: true } },
        },
      },
    },
  });

  if (!sale) return NextResponse.json({ error: "No such sale." }, { status: 404 });

  const canVoid = REVERSIBLE.includes(sale.paymentStatus);
  return NextResponse.json({ sale, canVoid });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { sme } = await requireSme();

  const sale = await prisma.sale.findFirst({
    where: { id: params.id, smeId: sme.id },
    select: { id: true, paymentStatus: true, totalAmount: true, notes: true, items: { select: { productId: true, quantity: true } } },
  });

  if (!sale) return NextResponse.json({ error: "No such sale." }, { status: 404 });

  if (!REVERSIBLE.includes(sale.paymentStatus)) {
    return NextResponse.json(
      {
        error: `This sale is already ${sale.paymentStatus.toLowerCase()} and cannot be voided again.`,
      },
      { status: 409 },
    );
  }

  // One transaction: either the sale is marked reversed AND the stock is
  // returned, or neither happens. Splitting them lets a crash leave stock
  // permanently short with no trace of the sale that caused it.
  const [, restored] = await prisma.$transaction(async (tx) => {
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        paymentStatus: "REVERSED",
        notes: sale.notes ? `${sale.notes}\n[voided] Reversed from sales history.` : "[voided] Reversed from sales history.",
      },
      select: { id: true, paymentStatus: true },
    });

    // Re-credit each line. Increments are per product row rather than a single
    // bulk update, because one sale can contain the same product twice (two
    // separate lines) and a single grouped update would only add the quantity
    // once.
    for (const item of sale.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }

    return [updated, true] as const;
  });

  return NextResponse.json({
    ok: true,
    saleId: sale.id,
    paymentStatus: "REVERSED",
    unitsReturned: sale.items.reduce((n, i) => n + i.quantity, 0),
    totalAmount: sale.totalAmount.toString(),
    restored,
  });
}