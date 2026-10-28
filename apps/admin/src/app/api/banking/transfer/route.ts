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
      const allAccounts = await prisma.account.findMany({});
      const toAccount = allAccounts.find((a: any) => a.accountNumber === toAccountNumber);

      if (!toAccount) {
        return NextResponse.json({ error: "Recipient account not found" }, { status: 404 });
      }

      // Prevent self-transfers
      if (toAccount.userId === fromAccount.userId) {
        return NextResponse.json({ error: "Cannot transfer to your own account" }, { status: 400 });
      }

      // Prisma returns Decimal, which is a class instance, not a string.
      const newFromBalance = (parseFloat(fromAccount.balance.toString()) - parseFloat(amount)).toFixed(2);
      const newToBalance = (parseFloat(toAccount.balance.toString()) + parseFloat(amount)).toFixed(2);

      await prisma.account.update({ where: { id: fromAccount.id }, data: { balance: newFromBalance } });
      await prisma.account.update({ where: { id: toAccount.id }, data: { balance: newToBalance } });

      // Create transactions
      await prisma.transaction.create({
        data: {
          reference: `TX-${Date.now()}`,
          type: "TRANSFER",
          description: `Transfer to ${toAccountNumber}: ${description}`,
          accountCode: "TRANSFER",
          amount: parseFloat(amount),
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