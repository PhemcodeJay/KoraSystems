import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const specPath = path.join(process.cwd(), "public", "openapi.json");

export function GET() {
  try {
    const data = fs.readFileSync(specPath, "utf-8");
    return new NextResponse(data, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("OpenAPI spec error:", err);
    return new NextResponse("Not found", { status: 404 });
  }
}