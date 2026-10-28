import { prisma } from "@kora/database";
import { withAuth } from "@kora/auth";
import { NextResponse } from "next/server";
import { sendPlatformGuide, PLATFORM_GUIDES } from "@/lib/whatsapp";

// POST /api/notifications/whatsapp - Send WhatsApp platform guide
export async function POST(req: Request) {
  const auth = await withAuth("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  try {
    const { phone, role, baseUrl } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const userRole = role || auth.user.role;
    const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://kora.co.ke";

    const result = await sendPlatformGuide(phone, userRole, url);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/notifications/whatsapp - Get available platform guides
export async function GET() {
  const auth = await withAuth("ADMIN", "SME", "SUPPLIER", "CUSTOMER");
  if (auth.response) return auth.response;

  const role = auth.user.role.toLowerCase();
  const guides = PLATFORM_GUIDES[role] || PLATFORM_GUIDES.sme;

  return NextResponse.json({ role, guides });
}