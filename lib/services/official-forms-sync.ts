import { OfficialFormLifecycleStatus, OfficialFormSupportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OFFICIAL_HOME_AFFAIRS_FORMS } from "@/lib/data/official-home-affairs-forms";
import { checksumBuffer, detectFillableFields } from "@/lib/services/pdf-form-engine";
import { auditEvent } from "@/lib/services/audit";

async function downloadPdfBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "AriaMigrationSaaS/1.0" } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncOfficialForms(input: { workspaceId: string; userId: string }) {
  const results = {
    checked: 0,
    downloaded: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    fillable: 0,
    manualOnly: 0,
    onlineOnly: 0
  };

  for (const seed of OFFICIAL_HOME_AFFAIRS_FORMS) {
    results.checked += 1;
    const existing = await prisma.officialFormTemplate.findFirst({
      where: {
        workspaceId: input.workspaceId,
        formNumber: seed.formNumber,
        OR: [{ sourceUrl: seed.sourceUrl ?? undefined }, { sourceUrl: null }]
      }
    });

    if (seed.supportStatus === "ONLINE_ONLY" || !seed.sourceUrl) {
      if (!existing) {
        await prisma.officialFormTemplate.create({
          data: {
            workspaceId: input.workspaceId,
            createdByUserId: input.userId,
            sourceType: "OFFICIAL",
            formNumber: seed.formNumber,
            title: seed.title,
            category: seed.category,
            sourceUrl: seed.sourceUrl,
            sourceName: seed.sourceName,
            subclassCodes: seed.subclassCodes,
            supportStatus: OfficialFormSupportStatus.ONLINE_ONLY,
            lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
            mappingNotes: seed.notes,
            lastCheckedAt: new Date()
          }
        });
      } else {
        await prisma.officialFormTemplate.update({
          where: { id: existing.id },
          data: {
            title: seed.title,
            category: seed.category,
            sourceUrl: seed.sourceUrl,
            sourceName: seed.sourceName,
            subclassCodes: seed.subclassCodes,
            supportStatus: OfficialFormSupportStatus.ONLINE_ONLY,
            lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
            lastCheckedAt: new Date(),
            mappingNotes: seed.notes
          }
        });
      }
      results.onlineOnly += 1;
      continue;
    }

    try {
      const buffer = await downloadPdfBuffer(seed.sourceUrl);
      const checksum = checksumBuffer(buffer);
      const inspection = await detectFillableFields(buffer);
      const supportStatus = inspection.fillable
        ? OfficialFormSupportStatus.FILLABLE_PDF
        : seed.supportStatus === "MANUAL_ONLY"
          ? OfficialFormSupportStatus.MANUAL_ONLY
          : OfficialFormSupportStatus.MAPPING_REQUIRED;

      const fieldSchemaJson = inspection.fields.map((field) => ({
        name: field.name,
        type: field.type,
        options: field.options ?? []
      }));

      if (!existing) {
        await prisma.officialFormTemplate.create({
          data: {
            workspaceId: input.workspaceId,
            createdByUserId: input.userId,
            sourceType: "OFFICIAL",
            formNumber: seed.formNumber,
            title: seed.title,
            category: seed.category,
            sourceUrl: seed.sourceUrl,
            sourceName: seed.sourceName,
            subclassCodes: seed.subclassCodes,
            lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
            supportStatus,
            downloadedAt: new Date(),
            lastCheckedAt: new Date(),
            checksum,
            fileName: `${seed.formNumber}.pdf`,
            mimeType: "application/pdf",
            fileData: buffer,
            fieldSchemaJson,
            mappingNotes: seed.notes
          }
        });
        results.downloaded += 1;
      } else if (existing.checksum !== checksum) {
        await prisma.officialFormTemplate.update({
          where: { id: existing.id },
          data: {
            title: seed.title,
            category: seed.category,
            sourceUrl: seed.sourceUrl,
            sourceName: seed.sourceName,
            subclassCodes: seed.subclassCodes,
            lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
            supportStatus,
            downloadedAt: new Date(),
            lastCheckedAt: new Date(),
            checksum,
            fileName: `${seed.formNumber}.pdf`,
            mimeType: "application/pdf",
            fileData: buffer,
            fieldSchemaJson,
            syncError: null,
            mappingNotes: seed.notes
          }
        });
        results.updated += 1;
      } else {
        await prisma.officialFormTemplate.update({
          where: { id: existing.id },
          data: {
            lastCheckedAt: new Date(),
            title: seed.title,
            category: seed.category,
            sourceName: seed.sourceName,
            subclassCodes: seed.subclassCodes,
            supportStatus,
            fieldSchemaJson,
            syncError: null,
            mappingNotes: seed.notes
          }
        });
        results.unchanged += 1;
      }

      if (inspection.fillable) results.fillable += 1;
      if (!inspection.fillable) results.manualOnly += 1;
    } catch (error) {
      results.failed += 1;
      if (existing) {
        await prisma.officialFormTemplate.update({
          where: { id: existing.id },
          data: {
            lastCheckedAt: new Date(),
            lifecycleStatus: OfficialFormLifecycleStatus.NEEDS_REVIEW,
            syncError: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  }

  await auditEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: "OfficialFormTemplate",
    entityId: input.workspaceId,
    action: "forms.sync",
    metadata: results
  });

  return results;
}
