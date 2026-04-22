import { NextResponse } from "next/server";
import { createClientReviewRequest } from "@/lib/services/application-draft";

export async function POST(req: Request) {
  const body = await req.json();
  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  const draftId = typeof body.draftId === "string" ? body.draftId : null;
  if (!matterId || !draftId) return NextResponse.json({ error: "matterId and draftId are required" }, { status: 400 });

  const request = await createClientReviewRequest({
    matterId,
    draftId,
    recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
    recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : undefined,
    message: typeof body.message === "string" ? body.message : undefined
  });

  return NextResponse.json({
    status: "sent_to_client",
    reviewRequired: true,
    message: "Client review request recorded. Provider integration can be attached later.",
    request
  });
}
