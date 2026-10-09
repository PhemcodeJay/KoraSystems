import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";
export async function GET() {
  const auth = await withAuth("SME","ADMIN","SUPPLIER");
  if (auth.response) return auth.response;
  const last = await prisma.receipt.findFirst({orderBy:{receiptNumber:"desc"}});
  return NextResponse.json({receiptNumber: (last?.receiptNumber ?? 0) + 1});
}
