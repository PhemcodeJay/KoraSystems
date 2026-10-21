import { prisma, type Prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await withAuth("SME","ADMIN","SUPPLIER");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN","SUPPLIER");

  // Receipt.saleId is a plain column, so the tenant boundary is resolved by
  // first collecting the sale ids this account is allowed to see.
  let saleIds: string[] | undefined;
  if (!scope.isAdmin) {
    const sales = await prisma.sale.findMany({
      where: scope.smeId
        ? { smeId: scope.smeId }
        : scope.supplierId
          ? { items: { some: { product: { supplierId: scope.supplierId } } } }
          : { id: "__none__" },
      select: { id: true },
    });
    saleIds = sales.map((s) => s.id);
  }

  const where: Prisma.ReceiptWhereInput = saleIds ? { saleId: { in: saleIds } } : {};

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(receipts);
}

export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const body = await request.json();

  if (!body.saleId) {
    return NextResponse.json({ error: "saleId is required." }, { status: 400 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id: body.saleId },
    select: { id: true, smeId: true },
  });
  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  if (!scope.isAdmin && sale.smeId !== scope.smeId) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }

  const existing = await prisma.receipt.findFirst({
    where: { saleId: sale.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A receipt already exists for this sale." },
      { status: 409 },
    );
  }

  // receiptNumber is @unique, so two concurrent requests computing
  // max+1 the same way would collide. Let the database allocate the number
  // and retry on the unique-constraint violation instead.
  let receipt;
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.receipt.findFirst({ orderBy: { receiptNumber: "desc" } });
    const receiptNumber = (last?.receiptNumber ?? 0) + 1;
    try {
      receipt = await prisma.receipt.create({
        data: {
          saleId: sale.id,
          receiptNumber,
          subtotal: body.subtotal,
          tax: body.tax,
          total: body.total,
          paymentMethod: body.paymentMethod,
        },
      });
      break;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002" || attempt === 2) throw error;
    }
  }

  return NextResponse.json(receipt, { status: 201 });
}
