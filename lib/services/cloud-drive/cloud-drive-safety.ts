import { type User } from "@prisma/client";
import type { CloudDriveExportType, CloudDriveManifest } from "@/lib/providers/cloud-drive-provider";
import { canAccessMatter, hasPermission } from "@/lib/services/roles";
import { sanitizeCloudDriveName, buildRecipientSafeReference } from "@/lib/services/cloud-drive/cloud-drive-redaction";

export const CLOUD_DRIVE_SAFETY_WARNING =
  "Cloud exports are operational file copies only. Sensitive documents should be exported only by authorised users and reviewed inside Aria before external use.";

export const CLOUD_DRIVE_CATEGORY_FOLDERS: Record<string, string> = {
  Identity: "01 Identity",
  Education: "02 Education",
  Employment: "03 Employment",
  Financial: "04 Financial",
  Relationship: "05 Relationship",
  "Health / Insurance": "06 Health Character",
  "Statements / Declarations": "08 Confirmations",
  Travel: "09 Correspondence",
  Forms: "07 Drafts"
};

export function getCloudDriveCategoryFolder(category: string) {
  return CLOUD_DRIVE_CATEGORY_FOLDERS[category] || "09 Correspondence";
}

export function sanitizeMatterFolderStructure(input: {
  clientReference?: string | null;
  clientName: string;
  clientId: string;
  matterReference?: string | null;
  matterId: string;
}) {
  const clientFolder = input.clientReference
    ? buildRecipientSafeReference({ clientReference: input.clientReference, fallbackId: input.clientId })
    : sanitizeCloudDriveName(input.clientName, `Client-${input.clientId.slice(0, 8)}`);
  const matterFolder = sanitizeCloudDriveName(input.matterReference || `Matter-${input.matterId.slice(0, 8)}`, "Matter");
  return {
    clientFolder,
    matterFolder
  };
}

export function assertCloudDriveExportPermission(input: {
  user: Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;
  matter: { id: string; workspaceId: string; assignedToUserId: string; assignedToUser?: { supervisorId: string | null } | null };
}) {
  if (!hasPermission(input.user, "can_export_data")) {
    throw new Error("You do not have permission to export matter content.");
  }
  if (!canAccessMatter(input.user, input.matter)) {
    throw new Error("Matter is not available for this user scope.");
  }
}

export function ensureSelectedDocumentScope(input: { selectedDocumentIds?: string[] | null; allDocumentIds: string[] }) {
  if (!input.selectedDocumentIds?.length) return;
  const allowed = new Set(input.allDocumentIds);
  for (const id of input.selectedDocumentIds) {
    if (!allowed.has(id)) {
      throw new Error("Selected document export includes a file outside the authorised matter scope.");
    }
  }
}

export function buildCloudDriveManifestSummary(manifest: CloudDriveManifest) {
  return {
    workspaceId: manifest.workspaceId,
    matterId: manifest.matterId,
    exportJobId: manifest.exportJobId ?? null,
    exportType: manifest.exportType,
    exportedByUserId: manifest.exportedByUserId,
    exportTimestamp: manifest.exportedAt,
    provider: manifest.provider,
    fileCount: manifest.fileCount,
    categoriesExported: manifest.categoriesExported,
    skippedItemsCount: manifest.skippedItemsCount,
    skippedReasons: manifest.skippedReasons,
    safetyWarning: manifest.safetyWarning
  };
}

export function exportTypeLabel(type: CloudDriveExportType) {
  const map: Record<CloudDriveExportType, string> = {
    matter_folder: "Matter folder export",
    draft_pack: "Draft pack export",
    invoice: "Invoice export",
    acknowledgement: "Acknowledgement export",
    selected_documents: "Selected document export"
  };
  return map[type];
}
