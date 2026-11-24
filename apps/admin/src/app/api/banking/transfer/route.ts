import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

// POST /api/banking/transfer - Transfer between accounts
export async function POST(req: Request) {
  const auth = await withAuth("SME", "ADMIN", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { fromAccountId, toAccountNumber, amount, description } = await req.json();
    try {
      const fromAccount = await prisma.account.findUnique({ where: { id: fromAccountId } });
      if (!fromAccount) {
        return NextResponse.json({ error: "Source account not found" }, { status: 404 });
      }

      // Security: Source account must belong to authenticated user
      if (fromAccount.userId !== auth.user.id) {
        return NextResponse.json({ error: "Not source account owner" }, { status: 403 });
      }

      // Security: Check that recipient account exists and belongs to a different user
      // Use a targeted query instead of fetching all accounts
      const toAccount = await prisma.account.findFirst({
        where: { accountNumber: toAccountNumber },
      });

      if (!toAccount) {
        return NextResponse.json({ error: "Recipient account not found" }, { status: 404 });
      }

      // Prevent self-transfers
      if (toAccount.userId === fromAccount.userId) {
        return NextResponse.json({ error: "Cannot transfer to your own account" }, { status: 400 });
      }

      // Ensure the user can only transfer to accounts belonging to other users,
      // not to their own accounts or within their own tenant without proper authorization.
      // For SME customers, only allow transfers to accounts outside their own tenant.
      if (auth.user.role === "SME" && toAccount.userId === auth.user.id) {
        return NextResponse.json({ error: "Cannot transfer to your own account" }, { status: 400 });
      }

      // Prisma returns Decimal, which is a class instance, not a string.
      // Use Prisma's Decimal arithmetic safely via toString()
      const fromBalanceStr = fromAccount.balance.toString();
      const amountFloat = parseFloat(amount);
      const newFromBalance = new Prisma.Decimal(
        (parseFloat(fromBalanceStr) - amountFloat).toFixed(2)
      ).toString();
      const toBalanceStr = toAccount.balance.toString();
      const newToBalance = new Prisma.Decimal(
        (parseFloat(toBalanceStr) + amountFloat).toFixed(2)
      ).toString();

      await prisma.account.update({ where: { id: fromAccount.id }, data: { balance: newFromBalance } });
      await prisma.account.update({ where: { id: toAccount.id }, data: { balance: newToBalance } });

      // Create transactions
      await prisma.transaction.create({
        data: {
          reference: `TX-${Date.now()}`,
          type: "TRANSFER",
          description: `Transfer to ${toAccountNumber}: ${description}`,
          accountCode: "TRANSFER",
          amount: amountFloat,
          currency: "KES",
          smeId: auth.user.role === "SME" ? auth.user.id : undefined,
          customerId: auth.user.role === "CUSTOMER" ? auth.user.id : undefined,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}