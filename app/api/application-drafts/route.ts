import { NextResponse } from "next/server";
import { createOrGetSubclass500Draft } from "@/lib/services/application-draft";

export async function POST(req: Request) {
  const body = await req.json();
  if (body.subclassCode !== "500") {
    return NextResponse.json({ error: "Only Subclass 500 draft workflows are available in this phase." }, { status: 400 });
  }

  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });

  const draft = await createOrGetSubclass500Draft(matterId);
  return NextResponse.json({ status: "ready", reviewRequired: true, draft });
}
