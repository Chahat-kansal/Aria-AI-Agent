import { DraftFieldStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { updateDraftFieldReview } from "@/lib/services/application-draft";

export async function POST(req: Request) {
  const body = await req.json();
  const draftFieldId = typeof body.draftFieldId === "string" ? body.draftFieldId : null;
  const status = typeof body.status === "string" ? body.status : null;

  if (!draftFieldId || !status || !(status in DraftFieldStatus)) {
    return NextResponse.json({ error: "draftFieldId and valid status are required" }, { status: 400 });
  }

  const field = await updateDraftFieldReview({
    draftFieldId,
    status: DraftFieldStatus[status as keyof typeof DraftFieldStatus],
    manualOverride: typeof body.manualOverride === "string" ? body.manualOverride : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined
  });

  return NextResponse.json({ status: "updated", field });
}
