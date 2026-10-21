import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const [sales, customers, supplierOrders, tills] = await Promise.all([
    prisma.sale.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
    prisma.customer.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
    prisma.supplierOrder.findMany({ take: 50, orderBy: { placedAt: "desc" } }),
    prisma.till.findMany({ where: { status: "open" } }),
  ]);

  return NextResponse.json({
    sales: sales.map((s) => ({
      id: s.id,
      smeId: s.smeId,
      totalAmount: s.totalAmount,
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      createdAt: s.createdAt.toISOString(),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      userId: c.userId,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      loyaltyPoints: c.loyaltyPoints,
      creditScore: c.creditScore,
    })),
    supplierOrders: supplierOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      smeId: o.smeId,
      supplierId: o.supplierId,
      status: o.status,
      totalAmount: o.totalAmount,
      placedAt: o.placedAt.toISOString(),
    })),
    openTills: tills.map((t) => ({
      id: t.id,
      name: t.name,
      currentBalance: t.currentBalance,
      openedBy: t.openedBy,
      openedAt: t.openedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;
  const body = await request.json();
  const { action, data } = body;

  switch (action) {
    case "sync_customer": {
      const customer = await prisma.customer.upsert({
        where: { userId: data.userId },
        update: data,
        create: { ...data, userId: data.userId },
      });
      return NextResponse.json({ action: "sync_customer", customer });
    }
    case "sync_sale": {
      const sale = await prisma.sale.create({
        data: {
          smeId: data.smeId,
          customerId: data.customerId,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus || "COMPLETED",
          simulated: data.simulated ?? true,
        },
      });
      return NextResponse.json({ action: "sync_sale", sale });
    }
    case "sync_supplier_order": {
      const order = await prisma.supplierOrder.create({
        data: {
          orderNumber: data.orderNumber,
          smeId: data.smeId,
          supplierId: data.supplierId,
          status: data.status || "PENDING",
          totalAmount: data.totalAmount,
          items: data.items,
        },
      });
      return NextResponse.json({ action: "sync_supplier_order", order });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}