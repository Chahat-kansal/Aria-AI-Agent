import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { auditDocumentUploaded, auditEvent } from "@/lib/services/audit";
import { getClientPortalSession } from "@/lib/services/client-portal-session";
import {
  attachDocumentToChecklistItem,
  getClientPortalByToken,
  getDocumentRequestByToken
} from "@/lib/services/client-workflows";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { getWorkspaceLaunchControls, isSubclassAllowedByLaunchControls } from "@/lib/services/launch-controls";
import { sendDocumentUploadedPush } from "@/lib/services/push/send-push";
import { getUploadLimits } from "@/lib/services/runtime-config";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";

const MOBILE_UPLOAD_ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const MOBILE_UPLOAD_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

type MobileUploadAcceptedType = (typeof MOBILE_UPLOAD_ACCEPTED_TYPES)[number];

type UploadQualityStatus =
  | "GOOD_QUALITY"
  | "ACCEPTABLE_WITH_REVIEW"
  | "POOR_QUALITY_REUPLOAD_RECOMMENDED"
  | "UNREADABLE_REUPLOAD_REQUIRED";

type PortalUploadContext = {
  workspaceId: string;
  matterId: string;
  checklistItemId: string;
  uploadedByUserId: string;
  notifyUserId: string | null;
  actorUserId: string | null;
  existingDocumentId: string | null;
  source: "portal_token" | "portal_session";
  portalId: string | null;
  requestId: string | null;
};

export type PortalUploadSuccess = {
  ok: true;
  document: {
    fileName: string;
    createdAt: string;
    qualityStatus: UploadQualityStatus | null;
    qualityScore: number | null;
    reuploadMessage: string | null;
  };
  checklist: {
    itemId: string;
    statusLabel: string;
    waitingForTeamReview: boolean;
    teamNote: string;
    uploadedAtLabel: string;
  };
  notification: {
    created: boolean;
  };
  extraction: {
    configured: boolean;
    qualityStatus: UploadQualityStatus | null;
    reviewMessage: string;
  };
};

export type PortalUploadFailure = {
  ok: false;
  status: number;
  error: string;
  code:
    | "OFFLINE"
    | "UNSUPPORTED_FILE"
    | "FILE_TOO_LARGE"
    | "EMPTY_FILE"
    | "MULTIPLE_FILES"
    | "DUPLICATE_FILE"
    | "UNAUTHORISED"
    | "INVALID_REQUEST"
    | "UPLOAD_FAILED";
};

export type PortalUploadResult = PortalUploadSuccess | PortalUploadFailure;

function isAcceptedClientMimeType(mimeType: string) {
  return (MOBILE_UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(mimeType);
}

function toUploadTimeLabel(value: Date) {
  return value.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function cleanUploadError(error: unknown): PortalUploadFailure {
  const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
  if (/one document at a time/i.test(message)) {
    return { ok: false, status: 400, error: "Please upload one document at a time.", code: "MULTIPLE_FILES" };
  }
  if (/empty file/i.test(message)) {
    return { ok: false, status: 400, error: "Please choose a file to upload.", code: "EMPTY_FILE" };
  }
  if (/unsupported file type|upload pdf, jpg, png, or webp|uploads of type/i.test(message)) {
    return { ok: false, status: 415, error: "This file type is not supported.", code: "UNSUPPORTED_FILE" };
  }
  if (/too large|max/i.test(message)) {
    return { ok: false, status: 413, error: "This file is too large.", code: "FILE_TOO_LARGE" };
  }
  if (/duplicate/i.test(message)) {
    return { ok: false, status: 409, error: "This file appears to match an existing upload.", code: "DUPLICATE_FILE" };
  }
  if (/invalid|expired|unavailable|not available|not authorised|not authorized|blocked/i.test(message)) {
    return { ok: false, status: 403, error: "This upload request is not available.", code: "UNAUTHORISED" };
  }
  return { ok: false, status: 500, error: "Upload failed. Please try again.", code: "UPLOAD_FAILED" };
}

async function auditClientUpload(input: {
  workspaceId: string;
  actorUserId?: string | null;
  entityId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.actorUserId || undefined,
    entityType: "ClientUpload",
    entityId: input.entityId || "portal",
    action: input.action,
    metadata: input.metadata as Prisma.InputJsonObject | undefined
  });
}

async function resolvePortalUploadContext(input: {
  checklistItemId: string;
  token?: string | null;
}): Promise<PortalUploadContext | null> {
  if (input.token?.trim()) {
    const request = await getDocumentRequestByToken(input.token.trim());
    if (request) {
      const requestItem = request.items.find((item) => item.checklistItemId === input.checklistItemId);
      if (!requestItem?.checklistItem) return null;
      return {
        workspaceId: request.workspaceId,
        matterId: request.matterId,
        checklistItemId: requestItem.checklistItemId,
        uploadedByUserId: request.createdByUserId,
        notifyUserId: request.matter.assignedToUserId ?? request.createdByUserId,
        actorUserId: request.createdByUserId ?? request.matter.assignedToUserId,
        existingDocumentId: requestItem.checklistItem.documentId,
        source: "portal_token",
        portalId: null,
        requestId: request.id
      };
    }

    const portal = await getClientPortalByToken(input.token.trim());
    if (!portal?.matter) return null;
    const checklistItem = portal.matter.checklistItems.find((item) => item.id === input.checklistItemId);
    if (!checklistItem || !portal.matterId) return null;
    return {
      workspaceId: portal.workspaceId,
      matterId: portal.matterId,
      checklistItemId: checklistItem.id,
      uploadedByUserId: portal.createdByUserId ?? portal.matter.assignedToUserId,
      notifyUserId: portal.matter.assignedToUserId,
      actorUserId: portal.createdByUserId ?? portal.matter.assignedToUserId,
      existingDocumentId: checklistItem.documentId,
      source: "portal_token",
      portalId: portal.id,
      requestId: null
    };
  }

  const sessionPortal = await getClientPortalSession();
  if (!sessionPortal?.matter || !sessionPortal.matterId) return null;
  const checklistItem = sessionPortal.matter.checklistItems.find((item) => item.id === input.checklistItemId);
  if (!checklistItem) return null;
  return {
    workspaceId: sessionPortal.workspaceId,
    matterId: sessionPortal.matterId,
    checklistItemId: checklistItem.id,
    uploadedByUserId: sessionPortal.createdByUserId ?? sessionPortal.matter.assignedToUserId,
    notifyUserId: sessionPortal.matter.assignedToUserId,
    actorUserId: sessionPortal.createdByUserId ?? sessionPortal.matter.assignedToUserId,
    existingDocumentId: checklistItem.documentId,
    source: "portal_session",
    portalId: sessionPortal.id,
    requestId: null
  };
}

export async function getMobileUploadConfigForWorkspace(workspaceId: string) {
  const [settings, limits] = await Promise.all([
    getWorkspaceOperationalSettingsView(workspaceId),
    Promise.resolve(getUploadLimits())
  ]);
  const acceptedMimeTypes = settings.documentAllowedMimeTypes.filter((mime) =>
    isAcceptedClientMimeType(mime as MobileUploadAcceptedType)
  );
  const effectiveMaxBytes = Math.min(limits.maxBytes, settings.documentMaxUploadBytes || limits.maxBytes);
  return {
    acceptedMimeTypes,
    acceptedFormatsLabel: "PDF, JPG, JPEG, PNG, WEBP",
    maxSizeMb: Math.max(1, Math.round(effectiveMaxBytes / (1024 * 1024))),
    maxSizeBytes: effectiveMaxBytes
  };
}

export async function processClientPortalUpload(input: {
  checklistItemId: string;
  file: File;
  token?: string | null;
}): Promise<PortalUploadResult> {
  const context = await resolvePortalUploadContext({
    checklistItemId: input.checklistItemId,
    token: input.token || null
  });

  if (!context) {
    return { ok: false, status: 403, error: "This upload request is not available.", code: "UNAUTHORISED" };
  }

  const safeFailure = async (failure: PortalUploadFailure, metadata?: Record<string, unknown>) => {
    await auditClientUpload({
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      entityId: context.checklistItemId,
      action:
        failure.code === "UNSUPPORTED_FILE"
          ? "client_upload.unsupported_file"
          : failure.code === "FILE_TOO_LARGE"
            ? "client_upload.too_large"
            : failure.code === "UNAUTHORISED"
              ? "client_upload.unauthorised_blocked"
              : "client_upload.failed",
      metadata: {
        matterId: context.matterId,
        checklistItemId: context.checklistItemId,
        source: context.source,
        ...metadata
      }
    });
    return failure;
  };

  try {
    if (!input.file) {
      return await safeFailure(
        { ok: false, status: 400, error: "Please choose a file to upload.", code: "EMPTY_FILE" }
      );
    }

    if (input.file.size <= 0) {
      return await safeFailure(
        { ok: false, status: 400, error: "Please choose a file to upload.", code: "EMPTY_FILE" }
      );
    }

    const uploadConfig = await getMobileUploadConfigForWorkspace(context.workspaceId);
    const mimeType = input.file.type || "application/octet-stream";

    if (!isAcceptedClientMimeType(mimeType) || !uploadConfig.acceptedMimeTypes.includes(mimeType)) {
      return await safeFailure(
        { ok: false, status: 415, error: "This file type is not supported.", code: "UNSUPPORTED_FILE" },
        { mimeType }
      );
    }

    if (input.file.size > uploadConfig.maxSizeBytes) {
      return await safeFailure(
        { ok: false, status: 413, error: "This file is too large.", code: "FILE_TOO_LARGE" },
        { fileSize: input.file.size, mimeType }
      );
    }

    const matter = await prisma.matter.findFirst({
      where: { id: context.matterId, workspaceId: context.workspaceId },
      include: { assignedToUser: true }
    });
    if (!matter) {
      return await safeFailure(
        { ok: false, status: 403, error: "This upload request is not available.", code: "UNAUTHORISED" }
      );
    }

    const launchControls = await getWorkspaceLaunchControls(context.workspaceId);
    if (!launchControls.allowRealClientUploads || !isSubclassAllowedByLaunchControls(launchControls, matter.visaSubclass)) {
      return await safeFailure(
        { ok: false, status: 403, error: "This upload request is not available.", code: "UNAUTHORISED" }
      );
    }

    await auditClientUpload({
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      entityId: context.checklistItemId,
      action: "client_upload.started",
      metadata: {
        matterId: context.matterId,
        checklistItemId: context.checklistItemId,
        fileSize: input.file.size,
        mimeType,
        source: context.source
      }
    });

    const bytes = Buffer.from(await input.file.arrayBuffer());
    const upload = await prepareMatterDocumentUpload({
      workspaceId: context.workspaceId,
      matterId: context.matterId,
      fileName: input.file.name,
      bytes,
      mimeType
    });

    const duplicate = await prisma.document.findFirst({
      where: {
        matterId: context.matterId,
        contentHash: upload.contentHash,
        ...(context.existingDocumentId ? { id: { not: context.existingDocumentId } } : {})
      },
      select: { id: true }
    });
    if (duplicate) {
      return await safeFailure(
        { ok: false, status: 409, error: "This file appears to match an existing upload.", code: "DUPLICATE_FILE" },
        { matterId: context.matterId, checklistItemId: context.checklistItemId }
      );
    }

    const extraction = await extractDocumentResult(bytes, mimeType, input.file.name);
    const document = await uploadDocumentToMatter({
      matterId: context.matterId,
      fileName: input.file.name,
      mimeType,
      storageKey: upload.storageKey,
      fileSize: upload.fileSize,
      contentHash: upload.contentHash,
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
      uploadedByUserId: context.uploadedByUserId
    });

    await persistDocumentStorageObject({ documentId: document.id, upload });
    await attachDocumentToChecklistItem(context.checklistItemId, document.id);
    await auditDocumentUploaded({
      workspaceId: context.workspaceId,
      userId: context.actorUserId || undefined,
      documentId: document.id,
      matterId: context.matterId,
      mimeType,
      fileSize: upload.fileSize
    });

    if (context.existingDocumentId) {
      await auditClientUpload({
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        entityId: context.checklistItemId,
        action: "client_upload.reupload_requested",
        metadata: {
          matterId: context.matterId,
          checklistItemId: context.checklistItemId,
          previousDocumentId: context.existingDocumentId,
          replacementDocumentId: document.id
        }
      });
    }

    if (
      extraction.documentQuality?.status === "POOR_QUALITY_REUPLOAD_RECOMMENDED" ||
      extraction.documentQuality?.status === "UNREADABLE_REUPLOAD_REQUIRED"
    ) {
      await auditClientUpload({
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        entityId: document.id,
        action: "client_upload.quality_flagged",
        metadata: {
          matterId: context.matterId,
          checklistItemId: context.checklistItemId,
          qualityStatus: extraction.documentQuality.status
        }
      });
    }

    const pushResult = context.notifyUserId
      ? await sendDocumentUploadedPush({
          workspaceId: context.workspaceId,
          userId: context.notifyUserId,
          clientId: matter.clientId,
          matterId: matter.id,
          dryRun: false,
          isAgentAlert: true,
          allowWithoutConsent: true
        } as any)
      : null;

    if (pushResult?.inAppNotificationId) {
      await auditClientUpload({
        workspaceId: context.workspaceId,
        actorUserId: context.actorUserId,
        entityId: document.id,
        action: "client_upload.notification_created",
        metadata: {
          matterId: context.matterId,
          checklistItemId: context.checklistItemId,
          notificationType: "agent_document_uploaded"
        }
      });
    }

    await auditClientUpload({
      workspaceId: context.workspaceId,
      actorUserId: context.actorUserId,
      entityId: document.id,
      action: "client_upload.completed",
      metadata: {
        matterId: context.matterId,
        checklistItemId: context.checklistItemId,
        mimeType,
        fileSize: upload.fileSize,
        qualityStatus: extraction.documentQuality?.status ?? null
      }
    });

    return {
      ok: true,
      document: {
        fileName: document.fileName,
        createdAt: document.createdAt.toISOString(),
        qualityStatus: extraction.documentQuality?.status ?? null,
        qualityScore: extraction.documentQuality?.score ?? null,
        reuploadMessage: extraction.documentQuality?.reuploadMessage ?? null
      },
      checklist: {
        itemId: context.checklistItemId,
        statusLabel: "Uploaded - waiting for team review",
        waitingForTeamReview: true,
        teamNote: "Your migration team will review this before use.",
        uploadedAtLabel: toUploadTimeLabel(document.createdAt)
      },
      notification: {
        created: Boolean(pushResult?.inAppNotificationId)
      },
      extraction: {
        configured: extraction.configured,
        qualityStatus: extraction.documentQuality?.status ?? null,
        reviewMessage: extraction.configured
          ? "Your migration team will review the uploaded file."
          : "Your migration team will review the uploaded file."
      }
    };
  } catch (error) {
    return safeFailure(cleanUploadError(error), {
      matterId: context.matterId,
      checklistItemId: context.checklistItemId,
      source: context.source
    });
  }
}

export function uploadJsonResponse(payload: PortalUploadResult) {
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : payload.status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
