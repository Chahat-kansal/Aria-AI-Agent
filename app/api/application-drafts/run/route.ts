import { NextResponse } from "next/server";
import { mapDocumentsToDraft } from "@/lib/services/application-draft";

export async function POST(req: Request) {
  const body = await req.json();
  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });

  const result = await mapDocumentsToDraft(matterId);
  return NextResponse.json({
    status: "mapped",
    message: "AI-assisted extraction and mapping completed. Agent review required.",
    result
  });
}
