import { NextResponse } from "next/server";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { attachDocumentToChecklistItem } from "@/lib/services/client-workflows";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { persistDocumentStorageObject, prepareMatterDocumentUpload } from "@/lib/services/storage";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { getUploadLimits, serverLog } from "@/lib/services/runtime-config";
import { auditDocumentUploaded, auditEvent } from "@/lib/services/audit";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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

    const context = await getCurrentWorkspaceContext();
    if (!context) return NextResponse.json({ error: "Authentication and workspace setup are required" }, { status: 401 });
    const limited = enforceRateLimit(req, { action: "document.upload.extract", scope: `${context.workspace.id}:${context.user.id}:${matterId}`, limit: 20, windowMs: 10 * 60 * 1000 });
    if (limited) return limited;
    if (!hasPermission(context.user, "can_edit_matters")) return NextResponse.json({ error: "You do not have permission to upload documents for matters." }, { status: 403 });
    const matter = await prisma.matter.findFirst({
      where: { id: matterId, workspaceId: context.workspace.id },
      include: { assignedToUser: true }
    });
    if (!matter || !canAccessMatter(context.user, matter)) return NextResponse.json({ error: "You do not have access to this matter." }, { status: 403 });
    const launchControls = await getWorkspaceLaunchControls(context.workspace.id);
    if (!launchControls.allowRealClientUploads) {
      return NextResponse.json({ error: "Document upload is disabled by launch controls until the owner explicitly enables real-client uploads." }, { status: 409 });
    }
    if (!isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
      return NextResponse.json({ error: `Document upload is disabled for Subclass ${matter.visaSubclass} by current launch controls.` }, { status: 409 });
    }
    if (!launchControls.allowedFileTypes.includes(mimeType)) {
      return NextResponse.json({ error: `Uploads of type ${mimeType} are disabled by launch controls.` }, { status: 415 });
    }
    if (file.size > launchControls.maxFileSizeMb * 1024 * 1024) {
      return NextResponse.json({ error: `File is too large for current launch controls. Maximum allowed size is ${launchControls.maxFileSizeMb} MB.` }, { status: 413 });
    }
    const extraction = await extractDocumentResult(bytes, mimeType, fileName);

    const upload = await prepareMatterDocumentUpload({ workspaceId: context.workspace.id, matterId, fileName, bytes, mimeType });

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
        normalizedKeyValues: extraction.normalizedKeyValues,
        documentQuality: extraction.documentQuality,
        extractedTextPreview: extraction.extractedTextPreview
      },
      uploadedByUserId: context.user.id
    });

    await persistDocumentStorageObject({ documentId: document.id, upload });
    await auditDocumentUploaded({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      documentId: document.id,
      matterId,
      fileName,
      mimeType,
      fileSize: upload.fileSize
    });
    await auditEvent({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "Document",
      entityId: document.id,
      action: "document.extracted",
      metadata: {
        matterId,
        provider: extraction.provider,
        confidence: extraction.confidence,
        warningCount: extraction.warnings.length,
        qualityStatus: extraction.documentQuality?.status,
        qualityScore: extraction.documentQuality?.score
      }
    });
    if (checklistItemId) {
      await attachDocumentToChecklistItem(checklistItemId, document.id).catch(() => null);
    }

    return NextResponse.json({
      status: "accepted",
      message: "Document recorded, classified, extracted, and mapped into the review-required draft workflow.",
      extraction: {
        provider: extraction.provider,
        confidence: extraction.confidence,
        warnings: extraction.warnings,
        qualityStatus: extraction.documentQuality?.status,
        qualityScore: extraction.documentQuality?.score,
        reuploadMessage: extraction.documentQuality?.reuploadMessage
      },
      document
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document upload failed. Please try again.";
    serverLog("document.upload_error", { error: message });
    const status =
      /not allowed|unsupported file type|required|storage is not configured|blocked until APP_FIELD_ENCRYPTION_KEY/i.test(message)
        ? 400
        : /too large/i.test(message)
          ? 413
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
