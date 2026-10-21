import { Prisma, prisma } from "@kora/database";
import { requireScope, withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

type CallbackMetadata = Record<string, unknown> & {
  status?: string;
  matchedSaleId?: string;
};

function asMetadata(value: unknown): CallbackMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CallbackMetadata;
}

export async function GET() {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const where = {
    type: "MPESA_C2B_UNRECONCILED",
    ...(scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" }),
  };
  const [transactions, sales] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { postedAt: "desc" },
      take: 100,
      select: {
        id: true,
        reference: true,
        amount: true,
        smeId: true,
        postedAt: true,
        metadata: true,
        smeOwner: { select: { businessName: true } },
      },
    }),
    prisma.sale.findMany({
      where: {
        ...(scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" }),
        paymentMethod: "MPESA_STK",
        paymentStatus: "COMPLETED",
        mpesaReceipt: null,
        transactionId: { not: null },
      },
      orderBy: { soldAt: "desc" },
      take: 500,
      select: {
        id: true,
        smeId: true,
        totalAmount: true,
        soldAt: true,
        transaction: { select: { reference: true } },
      },
    }),
  ]);

  const events = transactions
    .map((transaction) => ({
      ...transaction,
      metadata: asMetadata(transaction.metadata),
    }))
    .filter((transaction) => transaction.metadata.status === "RECEIVED_UNRECONCILED")
    .map((transaction) => ({
      id: transaction.id,
      reference: transaction.reference,
      amount: transaction.amount,
      postedAt: transaction.postedAt,
      smeId: transaction.smeId,
      businessName: transaction.smeOwner?.businessName ?? null,
      billReference:
        typeof transaction.metadata.billReference === "string"
          ? transaction.metadata.billReference
          : null,
      candidates: sales
        .filter(
          (sale) =>
            sale.smeId === transaction.smeId &&
            sale.totalAmount.equals(transaction.amount),
        )
        .map((sale) => ({
          id: sale.id,
          reference: sale.transaction?.reference ?? sale.id,
          soldAt: sale.soldAt,
          amount: sale.totalAmount,
        })),
    }));

  return NextResponse.json({ data: events });
}

export async function POST(request: Request) {
  const auth = await withAuth("SME", "ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME", "ADMIN");
  const body = (await request.json().catch(() => null)) as {
    reference?: unknown;
    saleId?: unknown;
    verifiedExternally?: unknown;
  } | null;
  const reference =
    typeof body?.reference === "string" ? body.reference.trim() : "";
  const saleId = typeof body?.saleId === "string" ? body.saleId.trim() : "";
  if (
    !/^C2B-[A-Za-z0-9]{4,32}$/.test(reference) ||
    !saleId ||
    body?.verifiedExternally !== true
  ) {
    return NextResponse.json(
      { error: "Confirm the C2B receipt against the merchant statement before reconciling." },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const callback = await tx.transaction.findUnique({
          where: { reference },
          select: { id: true, reference: true, type: true, amount: true, smeId: true, metadata: true },
        });
        if (
          !callback ||
          callback.type !== "MPESA_C2B_UNRECONCILED" ||
          (!scope.isAdmin && callback.smeId !== scope.smeId)
        ) {
          return { error: "C2B payment not found.", status: 404 as const };
        }

        const metadata = asMetadata(callback.metadata);
        if (metadata.status === "RECONCILED") {
          return metadata.matchedSaleId === saleId
            ? { reconciled: true as const, saleId }
            : { error: "This C2B payment has already been reconciled.", status: 409 as const };
        }
        if (metadata.status !== "RECEIVED_UNRECONCILED" || !callback.smeId) {
          return { error: "This C2B payment cannot be reconciled.", status: 409 as const };
        }

        const sale = await tx.sale.findFirst({
          where: {
            id: saleId,
            smeId: callback.smeId,
            totalAmount: callback.amount,
            paymentMethod: "MPESA_STK",
            paymentStatus: "COMPLETED",
            mpesaReceipt: null,
            transactionId: { not: null },
          },
          select: { id: true },
        });
        if (!sale) {
          return {
            error: "Choose an unreceipted, completed M-Pesa sale for the exact amount.",
            status: 409 as const,
          };
        }

        const receipt = reference.slice("C2B-".length);
        const duplicate = await tx.sale.findFirst({
          where: { mpesaReceipt: receipt, id: { not: sale.id } },
          select: { id: true },
        });
        if (duplicate) {
          return { error: "This M-Pesa receipt is already linked to another sale.", status: 409 as const };
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: { mpesaReceipt: receipt },
        });
        await tx.transaction.update({
          where: { id: callback.id },
          data: {
            metadata: {
              ...metadata,
              status: "RECONCILED",
              matchedSaleId: sale.id,
              reconciledAt: new Date().toISOString(),
              reconciledBy: auth.user.id,
              verification: "MERCHANT_STATEMENT_CONFIRMED",
            },
          },
        });
        return { reconciled: true as const, saleId: sale.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "The payment changed while reconciling. Refresh and try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}
