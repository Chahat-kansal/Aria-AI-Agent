import { NextResponse } from "next/server";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";

export async function POST(req: Request) {
  const body = await req.json();
  const fileName = typeof body.fileName === "string" ? body.fileName : "unknown.file";
  const matterId = typeof body.matterId === "string" ? body.matterId : null;
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });

  const { user } = await getCurrentWorkspaceContext();
  const document = await uploadDocumentToMatter({
    matterId,
    fileName,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream",
    storageKey: typeof body.storageKey === "string" ? body.storageKey : undefined,
    uploadedByUserId: user.id
  });

  return NextResponse.json({
    status: "accepted",
    message: "Document recorded, classified, extracted, and mapped into the review-required Subclass 500 draft.",
    document
  });
}
