import { NextResponse } from "next/server";
import { findC2bSme, parseC2bPayload } from "@/lib/mpesa-c2b";

export async function POST(request: Request) {
  const payload = parseC2bPayload(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Invalid payment details." },
    );
  }
  const smeId = await findC2bSme(payload.shortcode);
  if (!smeId) {
    return NextResponse.json(
      { ResultCode: 1, ResultDesc: "Business shortcode is not registered." },
    );
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
