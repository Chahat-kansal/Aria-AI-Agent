import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";

export type LegalReviewStatus = "draft" | "under_legal_review" | "approved_for_beta" | "approved_for_production";

export type WorkspaceLaunchControls = {
  betaModeEnabled: boolean;
  allowRealClientUploads: boolean;
  restrictBetaToSelectedUsers: boolean;
  restrictedUserEmails: string[];
  allowedSubclasses: string[];
  clientPortalEnabled: boolean;
  aiDraftAutofillEnabled: boolean;
  pdfFormFillingEnabled: boolean;
  exportEnabled: boolean;
  publicSignupEnabled: boolean;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
  legalReviewStatuses: {
    privacy: LegalReviewStatus;
    terms: LegalReviewStatus;
    security: LegalReviewStatus;
    aiDisclaimer: LegalReviewStatus;
    subprocessors: LegalReviewStatus;
  };
};

const DEFAULT_LAUNCH_CONTROLS: WorkspaceLaunchControls = {
  betaModeEnabled: true,
  allowRealClientUploads: false,
  restrictBetaToSelectedUsers: true,
  restrictedUserEmails: [],
  allowedSubclasses: ["500"],
  clientPortalEnabled: true,
  aiDraftAutofillEnabled: true,
  pdfFormFillingEnabled: true,
  exportEnabled: true,
  publicSignupEnabled: false,
  maxFileSizeMb: 15,
  allowedFileTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  legalReviewStatuses: {
    privacy: "draft",
    terms: "draft",
    security: "draft",
    aiDisclaimer: "draft",
    subprocessors: "draft"
  }
};

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeLegalStatus(value: unknown, fallback: LegalReviewStatus): LegalReviewStatus {
  return ["draft", "under_legal_review", "approved_for_beta", "approved_for_production"].includes(String(value))
    ? String(value) as LegalReviewStatus
    : fallback;
}

function parseLaunchControls(value: unknown): WorkspaceLaunchControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_LAUNCH_CONTROLS;
  const record = value as Record<string, unknown>;
  const candidate = typeof record.launchControls === "object" && record.launchControls && !Array.isArray(record.launchControls)
    ? record.launchControls as Record<string, unknown>
    : record;
  const legal = typeof candidate.legalReviewStatuses === "object" && candidate.legalReviewStatuses && !Array.isArray(candidate.legalReviewStatuses)
    ? candidate.legalReviewStatuses as Record<string, unknown>
    : {};

  return {
    betaModeEnabled: candidate.betaModeEnabled === undefined ? DEFAULT_LAUNCH_CONTROLS.betaModeEnabled : Boolean(candidate.betaModeEnabled),
    allowRealClientUploads: Boolean(candidate.allowRealClientUploads),
    restrictBetaToSelectedUsers: candidate.restrictBetaToSelectedUsers === undefined ? DEFAULT_LAUNCH_CONTROLS.restrictBetaToSelectedUsers : Boolean(candidate.restrictBetaToSelectedUsers),
    restrictedUserEmails: normalizeStringArray(candidate.restrictedUserEmails, DEFAULT_LAUNCH_CONTROLS.restrictedUserEmails),
    allowedSubclasses: normalizeStringArray(candidate.allowedSubclasses, DEFAULT_LAUNCH_CONTROLS.allowedSubclasses),
    clientPortalEnabled: candidate.clientPortalEnabled === undefined ? DEFAULT_LAUNCH_CONTROLS.clientPortalEnabled : Boolean(candidate.clientPortalEnabled),
    aiDraftAutofillEnabled: candidate.aiDraftAutofillEnabled === undefined ? DEFAULT_LAUNCH_CONTROLS.aiDraftAutofillEnabled : Boolean(candidate.aiDraftAutofillEnabled),
    pdfFormFillingEnabled: candidate.pdfFormFillingEnabled === undefined ? DEFAULT_LAUNCH_CONTROLS.pdfFormFillingEnabled : Boolean(candidate.pdfFormFillingEnabled),
    exportEnabled: candidate.exportEnabled === undefined ? DEFAULT_LAUNCH_CONTROLS.exportEnabled : Boolean(candidate.exportEnabled),
    publicSignupEnabled: Boolean(candidate.publicSignupEnabled),
    maxFileSizeMb: Math.max(1, Number(candidate.maxFileSizeMb || DEFAULT_LAUNCH_CONTROLS.maxFileSizeMb)),
    allowedFileTypes: normalizeStringArray(candidate.allowedFileTypes, DEFAULT_LAUNCH_CONTROLS.allowedFileTypes),
    legalReviewStatuses: {
      privacy: normalizeLegalStatus(legal.privacy, DEFAULT_LAUNCH_CONTROLS.legalReviewStatuses.privacy),
      terms: normalizeLegalStatus(legal.terms, DEFAULT_LAUNCH_CONTROLS.legalReviewStatuses.terms),
      security: normalizeLegalStatus(legal.security, DEFAULT_LAUNCH_CONTROLS.legalReviewStatuses.security),
      aiDisclaimer: normalizeLegalStatus(legal.aiDisclaimer, DEFAULT_LAUNCH_CONTROLS.legalReviewStatuses.aiDisclaimer),
      subprocessors: normalizeLegalStatus(legal.subprocessors, DEFAULT_LAUNCH_CONTROLS.legalReviewStatuses.subprocessors)
    }
  };
}

export async function getWorkspaceLaunchControls(workspaceId: string) {
  const settings = await getOrCreateWorkspaceOperationalSettings(workspaceId);
  return parseLaunchControls(settings.formsDefaultSettingsJson);
}

export async function updateWorkspaceLaunchControls(workspaceId: string, controls: WorkspaceLaunchControls) {
  await getOrCreateWorkspaceOperationalSettings(workspaceId);
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId },
    data: {
      formsDefaultSettingsJson: { launchControls: controls },
      documentMaxUploadBytes: controls.maxFileSizeMb * 1024 * 1024,
      documentAllowedMimeTypesJson: controls.allowedFileTypes
    }
  });
}

export function legalReviewStatusLabel(status: LegalReviewStatus) {
  return status.replaceAll("_", " ");
}

export function isSubclassAllowedByLaunchControls(controls: WorkspaceLaunchControls, subclass: string) {
  return controls.allowedSubclasses.includes(subclass)
    || (subclass === "820" && controls.allowedSubclasses.includes("820/801"))
    || (subclass === "801" && controls.allowedSubclasses.includes("820/801"))
    || (subclass === "309" && controls.allowedSubclasses.includes("309/100"))
    || (subclass === "100" && controls.allowedSubclasses.includes("309/100"));
}
