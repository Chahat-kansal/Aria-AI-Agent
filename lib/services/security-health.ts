import { prisma } from "@/lib/prisma";
import {
  getAiConfigStatus,
  getAuthConfigStatus,
  getCronConfigStatus,
  getDatabaseConfigStatus,
  getEmailConfigStatus,
  getEncryptionConfigStatus,
  getOcrConfigStatus,
  getStorageConfigStatus,
  getWebResearchConfigStatus
} from "@/lib/services/runtime-config";

export async function getSecurityHealth(workspaceId: string) {
  const [lastSweep, lastAuditEvent, lastIncident] = await Promise.all([
    prisma.migrationIntelSweep.findFirst({
      where: { OR: [{ workspaceId }, { workspaceId: null }], status: "COMPLETED" },
      orderBy: { startedAt: "desc" }
    }),
    prisma.auditEvent.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    }),
    prisma.securityIncident.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    auth: getAuthConfigStatus(),
    database: getDatabaseConfigStatus(),
    ai: getAiConfigStatus(),
    email: getEmailConfigStatus(),
    storage: getStorageConfigStatus(),
    encryption: getEncryptionConfigStatus(),
    ocr: getOcrConfigStatus(),
    webResearch: getWebResearchConfigStatus(),
    cron: getCronConfigStatus(),
    documentProtectionStatus: getStorageConfigStatus().configured && getEncryptionConfigStatus().configured,
    lastMigrationIntelSweep: lastSweep?.completedAt ?? lastSweep?.startedAt ?? null,
    lastAuditLogEvent: lastAuditEvent?.createdAt ?? null,
    lastSecurityIncident: lastIncident?.createdAt ?? null
  };
}
