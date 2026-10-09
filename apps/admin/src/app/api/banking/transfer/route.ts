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

      const accounts = await prisma.account.findMany({ where: { userId: auth.user.id } });
      const toAccount = accounts.find((a: any) => a.accountNumber === toAccountNumber);

      if (!toAccount) {
        return NextResponse.json({ error: "Recipient account not found" }, { status: 404 });
      }

      // Prisma returns Decimal, which is a class instance, not a string.
      // `parseFloat` implicitly stringifies its argument, so a Decimal would
      // be coerced via its `toString` — but TypeScript is right to reject it,
      // and being explicit keeps the coercion from silently changing meaning.
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
          simulated: true,
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