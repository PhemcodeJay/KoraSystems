import { scoreCredit, type CreditFactor } from "@kora/ai/commerce";
import { PrismaClient } from "../generated/client";

const riskRate = (score: number) => {
  if (score >= 750) return 0.16;
  if (score >= 650) return 0.19;
  if (score >= 580) return 0.23;
  if (score >= 420) return 0.28;
  return 0.32;
};

const maxLoanFor = (score: number, monthlyRevenue: number) => {
  const quality = score / 1000;
  return Math.round(
    Math.max(0, Math.min(300000, monthlyRevenue * 6 * (0.4 + quality))) * 100,
  ) / 100;
};

export async function scoreSmeCredit(db: PrismaClient, smeId: string) {
  const now = new Date();
  const firstDay = new Date(now);
  firstDay.setUTCHours(0, 0, 0, 0);
  firstDay.setUTCDate(firstDay.getUTCDate() - 89);
  const prior30Start = new Date(firstDay);
  prior30Start.setUTCDate(prior30Start.getUTCDate() + 30);
  const recent30Start = new Date(firstDay);
  recent30Start.setUTCDate(recent30Start.getUTCDate() + 60);

  const [
    sales90,
    customerSales,
    savings,
    sme,
    dailyRows,
    recentRevenue,
    priorRevenue,
    products,
    soldUnits,
    activeLoans,
    repayments,
    invoices,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { smeId, soldAt: { gte: firstDay } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    db.sale.findMany({
      where: { smeId, soldAt: { gte: firstDay }, customerId: { not: null } },
      select: { customerId: true },
    }),
    db.savings.findUnique({ where: { smeId } }),
    db.sME.findUniqueOrThrow({
      where: { id: smeId },
      select: { yearsInBusiness: true },
    }),
    db.$queryRaw<Array<{ d: string; amt: string }>>`
      select to_char(sold_at, 'YYYY-MM-DD') as d, sum(total_amount)::text as amt
      from kora.sales where sme_id = ${smeId} and sold_at >= ${firstDay}
      group by 1 order by 1`,
    db.sale.aggregate({
      where: { smeId, soldAt: { gte: recent30Start } },
      _sum: { totalAmount: true },
    }),
    db.sale.aggregate({
      where: { smeId, soldAt: { gte: prior30Start, lt: recent30Start } },
      _sum: { totalAmount: true },
    }),
    db.product.aggregate({
      where: { smeId, isActive: true },
      _sum: { stockQuantity: true },
    }),
    db.saleItem.aggregate({
      where: { sale: { smeId, soldAt: { gte: firstDay } } },
      _sum: { quantity: true },
    }),
    db.loan.findMany({
      where: { smeId, status: { in: ["DISBURSED", "REPAYING", "DEFAULTED"] } },
      select: { principal: true, amountRepaid: true },
    }),
    db.repayment.findMany({
      where: { loan: { smeId }, dueDate: { lte: now } },
      select: { status: true },
    }),
    db.invoice.findMany({
      where: { smeId },
      select: { status: true },
    }),
  ]);

  const revenue90d = Number(sales90._sum.totalAmount ?? 0);
  const salesCount90d = sales90._count._all;
  const monthlyRevenue = revenue90d / 3;
  const customerFrequency = new Map<string, number>();
  for (const sale of customerSales) {
    if (sale.customerId) {
      customerFrequency.set(sale.customerId, (customerFrequency.get(sale.customerId) ?? 0) + 1);
    }
  }
  const repeatCustomers = [...customerFrequency.values()].filter((count) => count > 1).length;
  const retention = customerFrequency.size > 0 ? repeatCustomers / customerFrequency.size : 0;

  const dailyTotals = new Map(dailyRows.map((row) => [row.d, Number(row.amt)]));
  const dailyAmounts = Array.from({ length: 90 }, (_, offset) => {
    const date = new Date(firstDay.getTime() + offset * 86_400_000);
    return dailyTotals.get(date.toISOString().slice(0, 10)) ?? 0;
  });
  const dailyMean = dailyAmounts.reduce((sum, amount) => sum + amount, 0) / dailyAmounts.length;
  const variance =
    dailyAmounts.reduce((sum, amount) => sum + (amount - dailyMean) ** 2, 0) /
    dailyAmounts.length;
  const coefficientOfVariation = dailyMean > 0 ? Math.sqrt(variance) / dailyMean : 2;
  const salesConsistency = Math.max(0, Math.min(100, 100 - (coefficientOfVariation / 2) * 100));
  const recent = Number(recentRevenue._sum.totalAmount ?? 0);
  const prior = Number(priorRevenue._sum.totalAmount ?? 0);
  const growth = prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0;
  const stock = products._sum.stockQuantity ?? 0;
  const units = soldUnits._sum.quantity ?? 0;
  const inventoryTurnover = units + stock > 0 ? (units / (units + stock)) * 100 : 50;
  const outstandingDebt = activeLoans.reduce(
    (sum, loan) => sum + Math.max(0, Number(loan.principal) - Number(loan.amountRepaid)),
    0,
  );
  const debtToIncome =
    monthlyRevenue > 0
      ? Math.max(0, 100 - (outstandingDebt / monthlyRevenue) * 20)
      : outstandingDebt > 0 ? 0 : 65;
  const paidRepayments = repayments.filter((repayment) => repayment.status === "PAID").length;
  const paymentHistory =
    repayments.length > 0 ? (paidRepayments / repayments.length) * 100 : 65;
  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID").length;
  const supplierRelations =
    invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 60;
  const savingsBalance = Number(savings?.balance ?? 0);
  const savingsBehaviour =
    monthlyRevenue > 0
      ? Math.min(100, (savingsBalance / monthlyRevenue) * 100)
      : savingsBalance > 0 ? 50 : 0;
  const factors: CreditFactor[] = [
    { name: "salesConsistency", weight: 12, score: salesConsistency, note: "Daily sales stability over 90 days, including non-trading days" },
    { name: "revenueGrowth", weight: 12, score: 50 + growth * 45, note: "Revenue change over the latest 30 days versus the prior 30" },
    { name: "transactionVolume", weight: 10, score: Math.min(100, salesCount90d / 4), note: `${salesCount90d} transactions in 90 days` },
    { name: "customerRetention", weight: 12, score: retention * 100, note: "Share of identified customers with repeat purchases" },
    { name: "paymentHistory", weight: 14, score: paymentHistory, note: `${paidRepayments} of ${repayments.length} due repayments paid` },
    { name: "businessAge", weight: 8, score: Math.min(100, ((sme.yearsInBusiness ?? 0) / 10) * 100), note: `${sme.yearsInBusiness ?? 0} years trading` },
    { name: "inventoryTurnover", weight: 8, score: inventoryTurnover, note: "Units sold relative to current stock and recent sales" },
    { name: "debtToIncome", weight: 14, score: debtToIncome, note: `Outstanding principal KES ${Math.round(outstandingDebt).toLocaleString()} against monthly sales` },
    { name: "savingsBehaviour", weight: 6, score: savingsBehaviour, note: `Savings KES ${Math.round(savingsBalance).toLocaleString()} relative to monthly sales` },
    { name: "supplierRelations", weight: 4, score: supplierRelations, note: `${paidInvoices} of ${invoices.length} supplier invoices paid` },
  ];
  const scoreResult = scoreCredit(factors);
  const maxLoan = maxLoanFor(scoreResult.score, monthlyRevenue);
  const recommendations =
    scoreResult.risk === "LOW"
      ? ["Eligible for standard human review", "Consider increasing stock cover for fast movers"]
      : scoreResult.risk === "MEDIUM"
        ? ["Improve repayment consistency to strengthen a future application", "Build savings relative to monthly sales"]
        : ["Reduce outstanding obligations before applying", "Grow a consistent sales history before reapplying"];

  return {
    ...scoreResult,
    revenue90d,
    salesCount90d,
    monthlyRevenue,
    retention,
    maxLoan,
    interestRate: riskRate(scoreResult.score),
    explanation: `Decision-support score ${scoreResult.score}/1000 (${scoreResult.risk}). Based on ${salesCount90d} sales and KES ${Math.round(monthlyRevenue).toLocaleString()} estimated monthly revenue over the last 90 days. Human review is required; this score is not an automated lending decision.`,
    recommendations,
    model: "explainable-credit-v1",
  };
}
