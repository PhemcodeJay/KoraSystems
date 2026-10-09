import { prisma } from "@kora/database";
import { withAuth, requireScope } from "@kora/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const where = scope.isAdmin ? {} : { smeId: scope.smeId ?? "__none__" };

  const insights = await prisma.insight.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(insights);
}

export async function POST(request: Request) {
  const auth = await withAuth("SME","ADMIN");
  if (auth.response) return auth.response;

  const scope = await requireScope("SME","ADMIN");
  const body = await request.json();

  // Insights are per-business; a non-admin always writes to its own record.
  let smeId = body.smeId as string | undefined;
  if (scope.isAdmin) {
    if (!smeId) {
      return NextResponse.json({ error: "smeId is required." }, { status: 400 });
    }
  } else {
    if (!scope.smeId) {
      return NextResponse.json(
        { error: "No business is linked to this account." },
        { status: 403 },
      );
    }
    smeId = scope.smeId;
  }

  const insight = await prisma.insight.create({
    data: {
      smeId,
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
