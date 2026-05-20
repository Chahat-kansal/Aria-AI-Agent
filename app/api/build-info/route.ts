import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "Aria Migration SaaS",
    ok: true
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
