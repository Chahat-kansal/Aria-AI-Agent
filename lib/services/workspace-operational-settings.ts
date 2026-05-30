import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
];

const DEFAULT_DOCUMENT_CATEGORIES = [
  "Identity",
  "Travel",
  "Education",
  "Employment",
  "Financial",
  "Relationship",
  "Health / Insurance",
  "Statements / Declarations",
  "Forms",
  "Other Evidence"
];

const DEFAULT_APPOINTMENT_TYPES = [
  { key: "consultation", label: "Consultation", durationMinutes: 45 },
  { key: "document-review", label: "Document review", durationMinutes: 30 },
  { key: "strategy-session", label: "Strategy session", durationMinutes: 60 }
];

const DEFAULT_APPOINTMENT_METHODS = ["Phone", "Video", "In-person"];

const DEFAULT_AVAILABILITY = [
  { weekday: 1, start: "09:00", end: "17:00" },
  { weekday: 2, start: "09:00", end: "17:00" },
  { weekday: 3, start: "09:00", end: "17:00" },
  { weekday: 4, start: "09:00", end: "17:00" },
  { weekday: 5, start: "09:00", end: "16:00" }
];

function arrayFromJson<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function getOrCreateWorkspaceOperationalSettings(workspaceId: string) {
  try {
    return await prisma.workspaceOperationalSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        clientPortalExpiryDays: 30,
        clientPortalConsentNotice:
          "I understand my information will be provided to my migration agent and may be processed by Aria to assist with document review and drafting.",
        clientPortalHelpText:
          "Your migration agent will review all information before use.",
        aiNoticeText:
          "AI-assisted output. Registered migration agent review required before use.",
        documentAllowedMimeTypesJson: DEFAULT_ALLOWED_MIME_TYPES,
        documentCategoriesJson: DEFAULT_DOCUMENT_CATEGORIES,
        appointmentTypesJson: DEFAULT_APPOINTMENT_TYPES,
        appointmentAvailabilityJson: DEFAULT_AVAILABILITY,
        appointmentMeetingMethodsJson: DEFAULT_APPOINTMENT_METHODS,
        integrationConnectionsJson: {}
      } as Prisma.WorkspaceOperationalSettingsUncheckedCreateInput,
      update: {}
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.workspaceOperationalSettings.findUnique({
        where: { workspaceId }
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function getWorkspaceOperationalSettingsView(workspaceId: string) {
  const settings = await getOrCreateWorkspaceOperationalSettings(workspaceId);
  return {
    ...settings,
    appointmentTypes: arrayFromJson(settings.appointmentTypesJson, DEFAULT_APPOINTMENT_TYPES),
    appointmentAvailability: arrayFromJson(settings.appointmentAvailabilityJson, DEFAULT_AVAILABILITY),
    appointmentMeetingMethods: arrayFromJson(settings.appointmentMeetingMethodsJson, DEFAULT_APPOINTMENT_METHODS),
    documentAllowedMimeTypes: arrayFromJson(settings.documentAllowedMimeTypesJson, DEFAULT_ALLOWED_MIME_TYPES),
    documentCategories: arrayFromJson(settings.documentCategoriesJson, DEFAULT_DOCUMENT_CATEGORIES),
    clientPortalConsentNotice: stringOrFallback(
      settings.clientPortalConsentNotice,
      "I understand my information will be provided to my migration agent and may be processed by Aria to assist with document review and drafting."
    ),
    clientPortalHelpText: stringOrFallback(settings.clientPortalHelpText, "Your migration agent will review all information before use."),
    aiNoticeText: stringOrFallback(settings.aiNoticeText, "AI-assisted output. Registered migration agent review required before use.")
  };
}
