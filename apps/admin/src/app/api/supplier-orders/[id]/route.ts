import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;
  const body = await request.json();
  const order = await prisma.supplierOrder.update({where:{id:params.id},data:{status:body.status}});
  return NextResponse.json(order);
}
