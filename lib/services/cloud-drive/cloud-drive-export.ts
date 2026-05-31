import { Prisma } from "@prisma/client";
import type { CloudDriveConnectionContext, CloudDriveExportType } from "@/lib/providers/cloud-drive-provider";
import { getCloudDriveProviderName, getCloudDriveProviderStatus } from "@/lib/providers/cloud-drive-provider";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/services/audit";
import { getWorkspaceProviderConnection, recordWorkspaceProviderActivity, upsertWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { createCloudDriveManifest, createCloudDriveManifestFile, createRedactedCloudDriveManifestPreview } from "@/lib/services/cloud-drive/export-manifest";
import { assertCloudDriveExportPermission, buildCloudDriveManifestSummary, exportTypeLabel, ensureSelectedDocumentScope } from "@/lib/services/cloud-drive/cloud-drive-safety";
import { buildMatterExportItems } from "@/lib/services/cloud-drive/matter-export-builder";
import { getCloudDriveProviderRouter } from "@/lib/services/cloud-drive/cloud-drive-provider-router";
import { redactCloudDriveError } from "@/lib/services/cloud-drive/cloud-drive-redaction";

type ExportUser = {
  id: string;
  workspaceId: string;
  role: any;
  visibilityScope: any;
  status: any;
  permissionsJson: Prisma.JsonValue | null;
};

async function createExportJob(input: {
  workspaceId: string;
  matterId: string;
  exportedByUserId: string;
  exportType: CloudDriveExportType;
  provider: string;
  manifestPreview: unknown;
}) {
  return prisma.cloudDriveExportJob.create({
    data: {
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      exportType: input.exportType,
      exportStatus: "STARTED",
      provider: input.provider,
      exportedByUserId: input.exportedByUserId,
      redactedManifestJson: input.manifestPreview as Prisma.InputJsonValue,
      startedAt: new Date()
    }
  });
}

async function createExportItems(input: {
  jobId: string;
  workspaceId: string;
  items: Awaited<ReturnType<typeof buildMatterExportItems>>["items"];
}) {
  if (!input.items.length) return;
  await prisma.cloudDriveExportItem.createMany({
    data: input.items.map((item) => ({
      exportJobId: input.jobId,
      workspaceId: input.workspaceId,
      fileName: item.fileName,
      fileCategory: item.category,
      fileSize: item.sizeBytes,
      providerFileId: null,
      providerFolderId: null
    }))
  });
}

async function recordCloudDriveEvent(input: {
  workspaceId: string;
  userId: string;
  exportJobId?: string | null;
  eventType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.cloudDriveEvent.create({
    data: {
      workspaceId: input.workspaceId,
      exportJobId: input.exportJobId ?? undefined,
      userId: input.userId,
      eventType: input.eventType,
      status: input.eventType.includes("failed") ? "FAILED" : "STARTED",
      summary: input.summary,
      metadataJson: input.metadata as Prisma.InputJsonValue | undefined
    }
  }).catch(() => null);
}

async function auditCloudDriveAction(input: {
  workspaceId: string;
  userId: string;
  matterId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "CloudDriveExport",
    entityId: input.matterId,
    action: input.action,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonObject
  });
}

export async function runCloudDriveExport(input: {
  workspaceId: string;
  matterId: string;
  user: ExportUser;
  exportType: CloudDriveExportType;
  selectedDocumentIds?: string[] | null;
  invoiceId?: string | null;
  acknowledgementRequestId?: string | null;
  dryRun?: boolean;
}) {
  const matter = await prisma.matter.findFirst({
    where: { id: input.matterId, workspaceId: input.workspaceId },
    include: { assignedToUser: true, documents: { select: { id: true } } }
  });
  if (!matter) throw new Error("Matter not found for this workspace.");
  try {
    assertCloudDriveExportPermission({ user: input.user, matter });
  } catch (error) {
    await auditCloudDriveAction({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      matterId: input.matterId,
      action: "cloud_drive.unauthorised_export_blocked",
      metadata: { reason: redactCloudDriveError(error) }
    }).catch(() => null);
    throw error;
  }
  ensureSelectedDocumentScope({
    selectedDocumentIds: input.selectedDocumentIds,
    allDocumentIds: matter.documents.map((document) => document.id)
  });

  const provider = getCloudDriveProviderName();
  const providerStatus = getCloudDriveProviderStatus();
  const built = await buildMatterExportItems({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    exportType: input.exportType,
    selectedDocumentIds: input.selectedDocumentIds,
    invoiceId: input.invoiceId,
    acknowledgementRequestId: input.acknowledgementRequestId
  });
  const manifest = createCloudDriveManifest({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    exportType: input.exportType,
    provider,
    exportedByUserId: input.user.id,
    items: [
      ...built.items.map((item) => ({
        path: item.path,
        category: item.category,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        sourceEntityType: item.sourceEntityType,
        sourceEntityId: item.sourceEntityId
      })),
      {
        path: `${built.matter.matterReference || built.matter.id}/00 Export Notes/export-manifest.json`,
        category: "00 Export Notes",
        fileName: "export-manifest.json",
        mimeType: "application/json",
        sizeBytes: 0,
        sourceEntityType: "manifest",
        sourceEntityId: built.matter.id
      }
    ],
    skippedReasons: built.skippedReasons
  });
  const preview = createRedactedCloudDriveManifestPreview(manifest);
  const job = await createExportJob({
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    exportedByUserId: input.user.id,
    exportType: input.exportType,
    provider,
    manifestPreview: preview
  });
  manifest.exportJobId = job.id;
  await createExportItems({ jobId: job.id, workspaceId: input.workspaceId, items: built.items });
  await recordCloudDriveEvent({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    exportJobId: job.id,
    eventType: "cloud_drive.export_started",
    summary: exportTypeLabel(input.exportType),
    metadata: { provider, fileCount: manifest.fileCount }
  });
  await auditCloudDriveAction({
    workspaceId: input.workspaceId,
    userId: input.user.id,
    matterId: input.matterId,
    action: "cloud_drive.export_started",
    metadata: { provider, exportType: input.exportType, fileCount: manifest.fileCount }
  });

  const connection = await getWorkspaceProviderConnection(input.workspaceId, "cloud_drive");
  const context: CloudDriveConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.user.id,
    provider,
    selectedFolderId: typeof connection?.metadataJson?.selectedFolderId === "string" ? connection.metadataJson.selectedFolderId : null
  };
  const adapter = await getCloudDriveProviderRouter(context);

  if (!providerStatus.configured || !connection?.connected || input.dryRun) {
    const manifestBytes = createCloudDriveManifestFile(manifest);
    await prisma.cloudDriveExportJob.update({
      where: { id: job.id },
      data: {
        exportStatus: "DRY_RUN",
        completedAt: new Date(),
        redactedManifestJson: preview as Prisma.InputJsonValue
      }
    });
    await recordCloudDriveEvent({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      exportJobId: job.id,
      eventType: "cloud_drive.manifest_generated",
      summary: "Dry-run manifest generated",
      metadata: { provider, exportType: input.exportType }
    });
    return {
      mode: providerStatus.configured && connection?.connected ? "dry_run" : "disabled",
      jobId: job.id,
      manifest,
      manifestPreview: preview,
      manifestBytes,
      localZipFallback: {
        available: true,
        href: `/api/settings/data/export-folder?matterId=${input.matterId}`
      }
    };
  }

  try {
    let currentFolderId = context.selectedFolderId ?? null;
    for (const item of built.items) {
      const pathParts = item.path.split("/");
      const folderParts = pathParts.slice(0, -1);
      currentFolderId = context.selectedFolderId ?? null;
      for (const part of folderParts) {
        const created = await adapter.createFolder({ ...context, name: part, parentFolderId: currentFolderId });
        if (!created.ok) throw new Error(created.reason || "Unable to create drive folder.");
        currentFolderId = created.providerFolderId ?? currentFolderId;
      }
      const upload = await adapter.uploadFile({
        ...context,
        payload: {
          fileName: item.fileName,
          mimeType: item.mimeType,
          bytes: item.bytes,
          folderId: currentFolderId
        }
      });
      if (!upload.ok) throw new Error(upload.reason || `Unable to upload ${item.fileName}.`);
      await auditCloudDriveAction({
        workspaceId: input.workspaceId,
        userId: input.user.id,
        matterId: input.matterId,
        action: "cloud_drive.file_uploaded",
        metadata: { provider, fileName: item.fileName, category: item.category }
      });
    }

    const manifestFileUpload = await adapter.uploadFile({
      ...context,
      payload: {
        fileName: "export-manifest.json",
        mimeType: "application/json",
        bytes: createCloudDriveManifestFile(manifest),
        folderId: currentFolderId
      }
    });
    if (!manifestFileUpload.ok) {
      throw new Error(manifestFileUpload.reason || "Unable to upload export manifest.");
    }

    await prisma.cloudDriveExportJob.update({
      where: { id: job.id },
      data: {
        exportStatus: "COMPLETED",
        providerFolderId: currentFolderId,
        completedAt: new Date(),
        redactedManifestJson: preview as Prisma.InputJsonValue
      }
    });
    await recordWorkspaceProviderActivity({
      workspaceId: input.workspaceId,
      key: "cloud_drive",
      providerName: provider,
      lastSyncAt: new Date(),
      lastSuccessfulActionAt: new Date(),
      lastErrorSummary: null,
      metadataJson: {
        ...(connection?.metadataJson ?? {}),
        selectedFolderId: context.selectedFolderId ?? null,
        rootFolderId: currentFolderId
      }
    });
    await recordCloudDriveEvent({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      exportJobId: job.id,
      eventType: "cloud_drive.export_completed",
      summary: "Cloud drive export completed",
      metadata: { provider, fileCount: manifest.fileCount }
    });
    await auditCloudDriveAction({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      matterId: input.matterId,
      action: "cloud_drive.export_completed",
      metadata: { provider, exportType: input.exportType, fileCount: manifest.fileCount }
    });
    return {
      mode: "live",
      jobId: job.id,
      manifest,
      manifestPreview: preview,
      providerFolderId: currentFolderId
    };
  } catch (error) {
    const reason = redactCloudDriveError(error);
    for (const skippedReason of built.skippedReasons) {
      await auditCloudDriveAction({
        workspaceId: input.workspaceId,
        userId: input.user.id,
        matterId: input.matterId,
        action: "cloud_drive.file_skipped",
        metadata: { provider, reason: skippedReason }
      }).catch(() => null);
    }
    await prisma.cloudDriveExportJob.update({
      where: { id: job.id },
      data: {
        exportStatus: "FAILED",
        completedAt: new Date(),
        lastError: reason
      }
    });
    await recordCloudDriveEvent({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      exportJobId: job.id,
      eventType: "cloud_drive.export_failed",
      summary: reason,
      metadata: { provider, exportType: input.exportType }
    });
    await auditCloudDriveAction({
      workspaceId: input.workspaceId,
      userId: input.user.id,
      matterId: input.matterId,
      action: "cloud_drive.export_failed",
      metadata: { provider, exportType: input.exportType, reason }
    });
    throw error;
  }
}

export async function getCloudDriveIntegrationView(workspaceId: string, userId: string) {
  const provider = getCloudDriveProviderStatus();
  const connection = await getWorkspaceProviderConnection(workspaceId, "cloud_drive");
  const context: CloudDriveConnectionContext = {
    workspaceId,
    userId,
    provider: getCloudDriveProviderName(),
    selectedFolderId: typeof connection?.metadataJson?.selectedFolderId === "string" ? connection.metadataJson.selectedFolderId : null
  };
  const router = await getCloudDriveProviderRouter(context);
  const [status, recentAudit, recentJobs, folders] = await Promise.all([
    router.getExportStatus(context),
    prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: {
          in: [
            "cloud_drive.provider_connected",
            "cloud_drive.provider_disconnected",
            "cloud_drive.connection_tested",
            "cloud_drive.token_refreshed",
            "cloud_drive.token_revoked",
            "cloud_drive.folder_listed",
            "cloud_drive.folder_created",
            "cloud_drive.export_started",
            "cloud_drive.export_completed",
            "cloud_drive.export_failed",
            "cloud_drive.file_uploaded",
            "cloud_drive.file_skipped",
            "cloud_drive.manifest_generated",
            "cloud_drive.unauthorised_export_blocked"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.cloudDriveExportJob.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    provider.configured && connection?.connected ? router.listFolders(context) : Promise.resolve([])
  ]);

  const manifestPreview = buildCloudDriveManifestSummary(createCloudDriveManifest({
    workspaceId,
    matterId: "matter-demo",
    exportType: "matter_folder",
    provider: status.provider,
    exportedByUserId: userId,
    items: [{
      path: "Client-DEMO/Matter-DEMO/07 Drafts/export-manifest.json",
      category: "07 Drafts",
      fileName: "export-manifest.json",
      mimeType: "application/json",
      sizeBytes: 512,
      sourceEntityType: "manifest",
      sourceEntityId: "matter-demo"
    }],
    skippedReasons: ["Unsupported file type skipped in preview."]
  }));

  return {
    provider,
    connection,
    status,
    authorizationUrl: provider.configured ? (await getCloudDriveProviderRouter(context)).getAuthorizationUrl(context) : null,
    folders,
    selectedFolderId: status.selectedFolderId,
    recentAudit,
    recentJobs,
    dryRunManifestPreview: manifestPreview,
    localZipFallback: {
      available: true,
      note: "Secure ZIP export is available through the app when a cloud drive provider is not configured."
    }
  };
}

export async function runCloudDriveConnectionTest(input: { workspaceId: string; userId: string }) {
  const context: CloudDriveConnectionContext = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    provider: getCloudDriveProviderName()
  };
  const provider = getCloudDriveProviderStatus();
  const router = await getCloudDriveProviderRouter(context);
  const folders = provider.configured ? await router.listFolders(context) : [];
  await auditCloudDriveAction({
    workspaceId: input.workspaceId,
    userId: input.userId,
    matterId: input.workspaceId,
    action: "cloud_drive.connection_tested",
    metadata: {
      provider: context.provider,
      result: provider.configured ? (folders.length ? "connected" : "configured_without_folders") : "not_configured",
      folderCount: folders.length
    }
  });
  return {
    ok: true,
    result: provider.configured ? (folders.length ? "connected" : "configured_without_folders") : "not_configured",
    folders
  };
}

export async function saveSelectedCloudDriveFolder(input: {
  workspaceId: string;
  folderId: string | null;
}) {
  const connection = await getWorkspaceProviderConnection(input.workspaceId, "cloud_drive");
  if (!connection) return null;
  return upsertWorkspaceProviderConnection({
    workspaceId: input.workspaceId,
    key: "cloud_drive",
    providerName: connection.providerName,
    tokenExpiresAt: connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null,
    scopes: connection.scopes,
    connectedAccountLabel: connection.connectedAccountLabel,
    metadataJson: {
      ...(connection.metadataJson ?? {}),
      selectedFolderId: input.folderId
    },
    lastSuccessfulActionAt: new Date(),
    lastErrorSummary: null
  });
}

export async function getMatterCloudExportPanelView(input: {
  workspaceId: string;
  matterId: string;
}) {
  const [matter, jobs, provider] = await Promise.all([
    prisma.matter.findFirst({
      where: { id: input.matterId, workspaceId: input.workspaceId },
      include: {
        client: true,
        documents: { orderBy: { createdAt: "desc" }, take: 12 },
        generatedDocuments: { orderBy: { createdAt: "desc" }, take: 12 },
        invoices: { orderBy: { createdAt: "desc" }, take: 8 },
        acknowledgementRequests: { orderBy: { createdAt: "desc" }, take: 8 }
      }
    }),
    prisma.cloudDriveExportJob.findMany({
      where: { workspaceId: input.workspaceId, matterId: input.matterId },
      include: { items: true, exportedByUser: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    Promise.resolve(getCloudDriveProviderStatus())
  ]);
  if (!matter) return null;
  return {
    matter,
    jobs,
    provider,
    localZipFallbackHref: `/api/settings/data/export-folder?matterId=${matter.id}`,
    latestPreview: jobs[0]?.redactedManifestJson ?? null
  };
}
