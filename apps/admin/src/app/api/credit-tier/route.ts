import { NextResponse } from "next/server";

/** GET /api/credit-tier?score=85  or  POST /api/credit-tier { "score": 85 } */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scoreStr = searchParams.get("score");
  if (scoreStr === null) {
    return NextResponse.json({ error: "query param `score` required" }, { status: 400 });
  }
  const score = Number(scoreStr);
  if (!Number.isFinite(score)) {
    return NextResponse.json({ error: "`score` must be a number" }, { status: 400 });
  }
  const th = Number(process.env.KORA_CREDIT_AUTO_APPROVE_THRESHOLD ?? "700");
  let tier: "auto-approve" | "manual-review" | "reject";
  if (score >= th) tier = "auto-approve";
  else if (score >= th - 50) tier = "manual-review";
  else tier = "reject";
  return NextResponse.json({ score, tier, threshold: th });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const score = Number(body?.score);
    if (!Number.isFinite(score)) {
      return NextResponse.json({ error: "`score` required and must be a number" }, { status: 400 });
    }
    const th = Number(process.env.KORA_CREDIT_AUTO_APPROVE_THRESHOLD ?? "700");
    let tier: "auto-approve" | "manual-review" | "reject";
    if (score >= th) tier = "auto-approve";
    else if (score >= th - 50) tier = "manual-review";
    else tier = "reject";
    return NextResponse.json({ score, tier, threshold: th });
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
}