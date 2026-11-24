import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/**
 * GET /api/ledger/reconcile
 *
 * Returns a summary of all ledger postings for the current period,
 * grouped by type, with totals to help operators verify double‑entry
 * correctness before going live.
 *
 * Response:
 * {
 *   period: string,
 *   postings: { type: string; count: number; totalAmount: number }[],
 *   balances: { asset: string; net: number }[],
 * }
 */
export async function GET() {
  try {
    // Pull the last 30 days of postings; adjust filter as needed.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const postings = await prisma.ledgerPosting.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by type (e.g., "sale", "refund", "adjustment")
    const grouped = postings.reduce<{
      postings: Record<string, number>;
      totalAmount: number;
      totalAmountByType: Record<string, number>;
    }>(
      (acc, p: { type: string; amount: number | null }) => {
        const type = p.type; // assuming type field on the model
        acc.postings[type] = (acc.postings[type] ?? 0) + 1;
        acc.totalAmountByType = acc.totalAmountByType ?? {};
        acc.totalAmountByType[type] = (acc.totalAmountByType[type] ?? 0) + (p.amount ?? 0);
        acc.totalAmount += p.amount ?? 0;
        return acc;
      },
      { postings: {}, totalAmount: 0, totalAmountByType: {} }
    );

    const postingsSummary = Object.entries(grouped.totalAmountByType).map(
      ([type, total]) => ({
        type,
        count: grouped.postings[type] ?? 0,
        totalAmount: total,
      })
    );

    // Compute net balances per asset (simple sum of debits minus credits)
    // This assumes each posting has `asset`, `debit`, `credit` fields.
    const assetPostings = await prisma.$queryRaw<
      { asset: string; debit: number; credit: number }[]
    >`
      SELECT asset,
             SUM(COALESCE(debit, 0)) AS debit,
             SUM(COALESCE(credit, 0)) AS credit
      FROM LedgerPosting
      WHERE createdAt >= ${thirtyDaysAgo}
      GROUP BY asset;
    `;

    const balances = assetPostings.map((row: { asset: string; debit: number; credit: number }) => ({
      asset: row.asset,
      net: (row.debit ?? 0) - (row.credit ?? 0),
    }));

    return NextResponse.json({
      period: "last-30-days",
      postings: postingsSummary,
      balances,
    });
  } catch (err) {
    console.error("Ledger reconcile error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve ledger reconciliation data" },
      { status: 500 }
    );
  }
}