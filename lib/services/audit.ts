import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditMetadata = Prisma.InputJsonObject;
export async function auditEvent(input: {
  workspaceId: string;
  userId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: AuditMetadata;
}) {
  try {
    await prisma.auditEvent.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? "system",
        entityType: input.entityType,
        entityId: input.entityId ?? "system",
        action: input.action,
        metadataJson: input.metadata ?? {}
      }
    });
  } catch (error) {
    console.error("[aria:audit_error]", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function auditAccessDenied(input: {
  workspaceId: string;
  userId?: string;
  entityType: string;
  entityId?: string;
  reason: string;
  metadata?: AuditMetadata;
}) {
  return auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: "access.denied",
    metadata: {
      reason: input.reason,
      ...(input.metadata ?? {})
    }
  });
}

export async function auditAiUsed(input: {
  workspaceId: string;
  userId?: string;
  feature: string;
  matterId?: string;
  metadata?: AuditMetadata;
}) {
  return auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "AI",
    entityId: input.matterId,
    action: "ai.used",
    metadata: {
      feature: input.feature,
      ...(input.metadata ?? {})
    }
  });
}

export async function auditDocumentUploaded(input: {
  workspaceId: string;
  userId?: string;
  documentId: string;
  matterId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number | null;
}) {
  return auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Document",
    entityId: input.documentId,
    action: "document.uploaded",
    metadata: {
      matterId: input.matterId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize
    }
  });
}

export async function auditPermissionChanged(input: {
  workspaceId: string;
  userId?: string;
  targetUserId: string;
  changedPermissions?: string[];
}) {
  return auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "User",
    entityId: input.targetUserId,
    action: "permission.changed",
    metadata: {
      changedPermissions: input.changedPermissions ?? []
    }
  });
}

export async function auditMatterAction(input: {
  workspaceId: string;
  userId?: string;
  matterId: string;
  action: string;
  metadata?: AuditMetadata;
}) {
  return auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "Matter",
    entityId: input.matterId,
    action: input.action,
    metadata: input.metadata
  });
}