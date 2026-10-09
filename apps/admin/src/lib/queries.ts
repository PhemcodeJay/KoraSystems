import { prisma } from "@kora/database";

/**
 * Formaters.
 *
 * `num` accepts anything Prisma or the DOM hands us — `Decimal`, `bigint`,
 * `null` — so callers never need an explicit conversion. Converting via
 * String() first is what keeps Decimal from being rejected at the type level.
 */
type Numeric = number | string | bigint | { toString(): string } | null | undefined;

const toNumber = (n: Numeric): number => {
  if (n === null || n === undefined) return 0;
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;
  if (typeof n === "bigint") return Number(n);
  if (typeof n === "object") return Number(n.toString());
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const fmtKES = (n: Numeric): string =>
  `KES ${toNumber(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export const fmtNum = (n: Numeric): string => toNumber(n).toLocaleString("en-KE");

export const fmtPct = (n: Numeric): string => `${(toNumber(n) * 100).toFixed(1)}%`;

export const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (d: Date | string | null | undefined): string => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

export async function getOverview() {
  const since30 = daysAgo(30);

  const [
    smeCount,
    customerCount,
    supplierCount,
    sales30,
    salesPrev30,
    sales365,
    ledgerAgg,
    loansByStatus,
    pendingLoans,
    portfolio,
    lowStock,
    unread,
  ] = await Promise.all([
    prisma.sME.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.sale.aggregate({
      where: { soldAt: { gte: since30 } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { soldAt: { gte: daysAgo(60), lt: since30 } },
      _sum: { totalAmount: true },
    }),
    prisma.sale.count({ where: { soldAt: { gte: daysAgo(365) } } }),
    prisma.ledgerEntry.aggregate({
      where: { transaction: { postedAt: { gte: since30 } } },
      _sum: { amount: true },
    }),
    prisma.loan.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.loan.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      take: 5,
      include: {
        sme: { select: { businessName: true } },
        creditScores: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.loan.aggregate({
      where: { status: { in: ["DISBURSED", "REPAYING"] } },
      _sum: { principal: true, amountRepaid: true },
    }),
    prisma.product.count({
      where: { stockQuantity: { lte: 20 }, isActive: true },
    }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  const revenue30 = Number(sales30._sum.totalAmount ?? 0);
  const prevRevenue30 = Number(salesPrev30._sum.totalAmount ?? 0);
  const principal = Number(portfolio._sum.principal ?? 0);
  const repaid = Number(portfolio._sum.amountRepaid ?? 0);

  return {
    smeCount,
    customerCount,
    supplierCount,
    revenue30,
    salesCount30: sales30._count._all,
    salesCount365: sales365,
    revenueGrowth: prevRevenue30 > 0 ? (revenue30 - prevRevenue30) / prevRevenue30 : null,
    ledgerVolume30: Number(ledgerAgg._sum.amount ?? 0),
    loansByStatus: Object.fromEntries(loansByStatus.map((l) => [l.status, l._count._all])),
    loanCount: loansByStatus.reduce((s, l) => s + l._count._all, 0),
    pendingLoans,
    outstanding: Math.max(0, principal - repaid),
    repaymentRate: principal > 0 ? repaid / principal : 0,
    lowStock,
    unread,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;

/** Daily revenue + sale count for the trend chart. */
export async function getRevenueSeries(days = 30) {
  const rows = await prisma.$queryRaw<Array<{ day: string; revenue: string; sales: number }>>`
    select to_char(sold_at, 'YYYY-MM-DD') as day,
           sum(total_amount)::text as revenue,
           count(*)::int as sales
    from kora.sales
    where sold_at >= now() - (${days} || ' days')::interval
    group by 1 order by 1
  `;
  return rows.map((r) => ({
    day: r.day,
    label: new Date(r.day).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }),
    revenue: Number(r.revenue),
    sales: r.sales,
  }));
}

export async function getSmes() {
  return prisma.sME.findMany({
    orderBy: { businessName: "asc" },
    include: {
      user: { select: { email: true, fullName: true, isActive: true } },
      creditScores: { orderBy: { createdAt: "desc" }, take: 1 },
      loans: { select: { status: true, principal: true } },
      _count: { select: { products: true, sales: true } },
    },
  });
}

export async function getLoans() {
  return prisma.loan.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      sme: {
        select: {
          id: true,
          businessName: true,
          county: true,
          town: true,
          user: { select: { email: true } },
        },
      },
      creditScores: { orderBy: { createdAt: "desc" }, take: 1 },
      repayments: { orderBy: { installmentNumber: "asc" } },
    },
  });
}

export async function getTransactions(
  opts: { take?: number; account?: string; type?: string } = {},
) {
  return prisma.transaction.findMany({
    take: opts.take ?? 50,
    orderBy: { postedAt: "desc" },
    where: {
      ...(opts.account ? { accountCode: opts.account } : {}),
      ...(opts.type ? { type: opts.type } : {}),
    },
    include: {
      entries: true,
      smeOwner: { select: { businessName: true } },
    },
  });
}

/** One transaction with its legs, for the double-entry drill-in. */
export async function getTransactionWithEntries(reference: string) {
  return prisma.transaction.findUnique({
    where: { reference },
    include: { entries: true, smeOwner: { select: { businessName: true } } },
  });
}

/** Portfolio report: exposure and arrears per SME. */
export async function getPortfolio() {
  const rows = await prisma.$queryRaw<
    Array<{
      sme_id: string;
      business_name: string;
      loans: number;
      principal: string;
      repaid: string;
      overdue: number;
    }>
  >`
    select
      s.id as sme_id,
      s.business_name,
      count(distinct l.id)::int as loans,
      coalesce(sum(l.principal), 0)::text as principal,
      coalesce(max(l.amount_repaid), 0)::text as repaid,
      count(r.id) filter (where r.status = 'OVERDUE')::int as overdue
    from kora.smes s
    left join kora.loans l on l.sme_id = s.id
    left join kora.repayments r on r.loan_id = l.id
    group by s.id, s.business_name
    having count(l.id) > 0
    order by 3 desc, 2 asc
  `;

  return rows.map((r) => {
    const principal = Number(r.principal);
    const repaid = Number(r.repaid);
    return {
      smeId: r.sme_id,
      businessName: r.business_name,
      loans: r.loans,
      principal,
      repaid,
      outstanding: Math.max(0, principal - repaid),
      repaymentRate: principal > 0 ? Math.min(1, repaid / principal) : 0,
      overdueInstalments: r.overdue,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-account views.
//
// Every query below is keyed off the signed-in account's own id, never a value
// supplied by the client, so one business cannot read another's figures.
// ---------------------------------------------------------------------------

export async function getSmeOverview(smeId: string) {
  const [sme, revenue, recentSales, products, loans, savings, insights, lowStock, customers] =
    await Promise.all([
      prisma.sME.findUnique({ where: { id: smeId } }),
      prisma.sale.aggregate({
        where: { smeId, soldAt: { gte: daysAgo(30) } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.sale.findMany({
        where: { smeId },
        orderBy: { soldAt: "desc" },
        take: 10,
        include: { customer: { select: { fullName: true } } },
      }),
      prisma.product.findMany({
        where: { smeId, isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          price: true,
          stockQuantity: true,
          reorderLevel: true,
        },
      }),
      prisma.loan.findMany({
        where: { smeId },
        orderBy: { createdAt: "desc" },
        include: { creditScores: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      prisma.savings.findUnique({ where: { smeId } }),
      prisma.insight.findMany({
        where: { smeId },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.product.count({ where: { smeId, isActive: true, stockQuantity: { lte: 20 } } }),
      prisma.customer.count({
        where: { sales: { some: { smeId } } },
      }),
    ]);

  return {
    sme,
    revenue30: Number(revenue._sum.totalAmount ?? 0),
    salesCount30: revenue._count._all,
    recentSales,
    products,
    loans,
    savings,
    insights,
    lowStock,
    customers,
  };
}

export async function getSupplierOverview(supplierId: string) {
  const [supplier, orders, products, pendingValue, revenue30] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.order.findMany({
      where: { supplierId },
      orderBy: { placedAt: "desc" },
      take: 15,
      include: { sme: { select: { businessName: true, town: true } } },
    }),
    prisma.product.findMany({
      where: { supplierId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, price: true, stockQuantity: true },
    }),
    prisma.order.aggregate({
      where: { supplierId, status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { supplierId, status: "PAID" },
      _sum: { amountPaid: true },
    }),
  ]);

  return {
    supplier,
    orders,
    products,
    pendingOrders: pendingValue._count._all,
    pendingValue: Number(pendingValue._sum.totalAmount ?? 0),
    revenuePaid: Number(revenue30._sum.amountPaid ?? 0),
  };
}

export async function getCustomerOverview(customerId: string) {
  const [customer, sales, bnpl, points] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.sale.findMany({
      where: { customerId },
      orderBy: { soldAt: "desc" },
      take: 15,
      include: { sme: { select: { businessName: true } } },
    }),
    prisma.bNPL.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: {
        sme: { select: { businessName: true } },
        installments: { orderBy: { installmentNumber: "asc" } },
      },
    }),
    prisma.sale.aggregate({
      where: { customerId },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    customer,
    sales,
    bnpl,
    lifetimeSpend: Number(points._sum.totalAmount ?? 0),
    purchaseCount: points._count._all,
  };
}


