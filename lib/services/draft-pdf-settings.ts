import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";

export type DraftPdfSettings = {
  termsText: string;
  footerText: string;
};

const DEFAULT_DRAFT_PDF_SETTINGS: DraftPdfSettings = {
  termsText:
    "This document is an AI-assisted working draft prepared for migration agent review. It is not final migration advice, does not guarantee any visa outcome, and must not be lodged or submitted without registered migration agent review and client confirmation.",
  footerText:
    "AI-assisted output. Registered migration agent review required before use. Aria does not lodge applications."
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown, fallback: string, max = 4000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

export function parseDraftPdfSettings(value: unknown): DraftPdfSettings {
  const record = asRecord(value);
  const candidate = asRecord(record.draftPdfSettings);
  return {
    termsText: cleanText(candidate.termsText, DEFAULT_DRAFT_PDF_SETTINGS.termsText),
    footerText: cleanText(candidate.footerText, DEFAULT_DRAFT_PDF_SETTINGS.footerText, 600)
  };
}

export async function getWorkspaceDraftPdfSettings(workspaceId: string) {
  const settings = await getOrCreateWorkspaceOperationalSettings(workspaceId);
  return parseDraftPdfSettings(settings.formsDefaultSettingsJson);
}

export async function updateWorkspaceDraftPdfSettings(workspaceId: string, next: Partial<DraftPdfSettings>) {
  const settings = await getOrCreateWorkspaceOperationalSettings(workspaceId);
  const currentRoot = asRecord(settings.formsDefaultSettingsJson);
  const current = parseDraftPdfSettings(currentRoot);
  const draftPdfSettings: DraftPdfSettings = {
    termsText: cleanText(next.termsText, current.termsText),
    footerText: cleanText(next.footerText, current.footerText, 600)
  };

  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId },
    data: {
      formsDefaultSettingsJson: {
        ...currentRoot,
        draftPdfSettings
      } as Prisma.InputJsonValue
    }
  });

  return draftPdfSettings;
}

