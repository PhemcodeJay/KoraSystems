import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;
  const body = await request.json();
  const insight = await prisma.insight.create({
    data: {
      smeId: body.smeId,
      type: body.type,
      title: body.title,
      body: body.body,
      payload: body.payload,
      priority: body.priority || 0,
      isRead: false,
    },
  });
  return NextResponse.json(insight, {status:201});
}