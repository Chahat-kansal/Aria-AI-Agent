import type { CloudDriveExportType, CloudDriveManifest, CloudDriveManifestItem, CloudDriveProviderName } from "@/lib/providers/cloud-drive-provider";
import { CLOUD_DRIVE_SAFETY_WARNING, buildCloudDriveManifestSummary } from "@/lib/services/cloud-drive/cloud-drive-safety";
import { redactCloudDriveManifestJson } from "@/lib/services/cloud-drive/cloud-drive-redaction";

export function createCloudDriveManifest(input: {
  workspaceId: string;
  matterId: string;
  exportJobId?: string | null;
  exportType: CloudDriveExportType;
  provider: CloudDriveProviderName;
  exportedByUserId: string;
  items: CloudDriveManifestItem[];
  skippedReasons?: string[];
}) {
  const categories = Array.from(new Set(input.items.map((item) => item.category))).sort();
  return {
    workspaceId: input.workspaceId,
    matterId: input.matterId,
    exportJobId: input.exportJobId ?? null,
    exportType: input.exportType,
    provider: input.provider,
    exportedByUserId: input.exportedByUserId,
    exportedAt: new Date().toISOString(),
    fileCount: input.items.length,
    categoriesExported: categories,
    skippedItemsCount: input.skippedReasons?.length ?? 0,
    skippedReasons: input.skippedReasons ?? [],
    safetyWarning: CLOUD_DRIVE_SAFETY_WARNING,
    items: input.items
  } satisfies CloudDriveManifest;
}

export function createCloudDriveManifestFile(manifest: CloudDriveManifest) {
  return Buffer.from(
    JSON.stringify(buildCloudDriveManifestSummary(manifest), null, 2),
    "utf8"
  );
}

export function createRedactedCloudDriveManifestPreview(manifest: CloudDriveManifest) {
  return redactCloudDriveManifestJson(buildCloudDriveManifestSummary(manifest));
}
