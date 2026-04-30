import { NextResponse } from "next/server";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { attachDocumentToChecklistItem } from "@/lib/services/client-workflows";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { persistDocumentStorageObject, prepareMatterDocumentUpload } from "@/lib/services/storage";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { getUploadLimits, serverLog } from "@/lib/services/runtime-config";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "multipart file upload is required" }, { status: 415 });
    }

    const formData = await req.formData();
    const matterId = typeof formData.get("matterId") === "string" ? String(formData.get("matterId")) : null;
    const checklistItemId = typeof formData.get("checklistItemId") === "string" ? String(formData.get("checklistItemId")) : null;
    if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    const fileName = file.name;
    const mimeType = file.type || "application/octet-stream";
    const limits = getUploadLimits();
    if (file.size > limits.maxBytes) return NextResponse.json({ error: `File is too large. Maximum upload size is ${limits.maxMb} MB.` }, { status: 413 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const extraction = await extractDocumentResult(bytes, mimeType);

    const context = await getCurrentWorkspaceContext();
    if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
    if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to upload documents for matters." }, { status: 403 });
    const matter = await prisma.matter.findFirst({
      where: { id: matterId, workspaceId: context.workspace.id },
      include: { assignedToUser: true }
    });
    if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });

    const upload = await prepareMatterDocumentUpload({ matterId, fileName, bytes });

    const document = await uploadDocumentToMatter({
      matterId,
      fileName,
      mimeType,
      storageKey: upload?.storageKey,
      fileSize: upload?.fileSize,
      contentHash: upload?.contentHash,
      extractedText: extraction.extractedText,
      extractionMetadata: {
        provider: extraction.provider,
        model: extraction.model,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        configured: extraction.configured,
        keyValues: extraction.keyValues,
        extractedTextPreview: extraction.extractedTextPreview
      },
      uploadedByUserId: context.user.id
    });

    await persistDocumentStorageObject({ documentId: document.id, upload });
    if (checklistItemId) {
      await attachDocumentToChecklistItem(checklistItemId, document.id).catch(() => null);
    }

    return NextResponse.json({
      status: "accepted",
      message: "Document recorded, classified, extracted, and mapped into the review-required draft workflow.",
      extraction: {
        provider: extraction.provider,
        confidence: extraction.confidence,
        warnings: extraction.warnings
      },
      document
    });
  } catch (error) {
    serverLog("document.upload_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Document upload failed. Please try again." }, { status: 500 });
  }
}
