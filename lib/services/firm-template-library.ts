import { GeneratedDocumentType } from "@prisma/client";

export type FirmTemplateCategory =
  | "cover_letter"
  | "submission"
  | "statutory_declaration"
  | "request_response"
  | "character_health"
  | "document_checklist"
  | "official_form_pdf"
  | "invoice";

export type FirmTemplateLibraryItem = {
  id: string;
  title: string;
  category: FirmTemplateCategory;
  source: "system_structure" | "firm_provided" | "workspace_generated";
  reviewRequired: true;
  sharedPlatformLibrary: false;
  canPopulateFromWorkingDataPack: boolean;
  safePopulationRule: string;
  versioningRule: string;
  approvalRule: string;
};

export const firmTemplateLibraryPolicy = {
  sharedPlatformLibraryFromClientContent: false,
  anonymisedSharingDefault: false,
  platformAdminCanReadFirmTemplatesByDefault: false,
  allowedPopulationSources: [
    "verified draft fields",
    "approved AI Working Copy fields",
    "submitted client confirmations",
    "matter metadata",
    "workspace and assigned agent profile"
  ],
  blockedPopulationSources: [
    "raw uploaded document bytes",
    "raw storage URLs",
    "token hashes",
    "unapproved extracted fields",
    "other clients or matters"
  ]
};

export const systemPrecedentTemplates: FirmTemplateLibraryItem[] = [
  {
    id: "cover-letter",
    title: "Cover letter structure",
    category: "cover_letter",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: true,
    safePopulationRule: "Populate only from approved Working Data Pack fields and verified matter metadata.",
    versioningRule: "Save as a new workspace version before firm-specific wording is reused.",
    approvalRule: "Senior or assigned agent approval required before client-facing use."
  },
  {
    id: "submission-outline",
    title: "Submission outline structure",
    category: "submission",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: true,
    safePopulationRule: "Insert missing markers instead of drafting facts that are not approved.",
    versioningRule: "Keep each major wording update as a distinct firm version.",
    approvalRule: "Registered migration agent review required."
  },
  {
    id: "statutory-declaration",
    title: "Statutory declaration prompt structure",
    category: "statutory_declaration",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: false,
    safePopulationRule: "Use as a checklist/prompt only; do not invent declarations or signatures.",
    versioningRule: "Version prompt wording by matter type.",
    approvalRule: "Client confirmation and agent review required."
  },
  {
    id: "request-response",
    title: "Request response pack structure",
    category: "request_response",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: true,
    safePopulationRule: "Use only request metadata, approved evidence summaries, and agent-entered response text.",
    versioningRule: "Version per request type such as Section 56, natural justice, or character response.",
    approvalRule: "Agent review required before sending."
  },
  {
    id: "character-health-response",
    title: "Character and health response structure",
    category: "character_health",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: false,
    safePopulationRule: "Mark all sensitive declarations as client confirmation and agent review required unless explicitly captured.",
    versioningRule: "Keep separate versions for character, health waiver, and PIC 4020 support workflows.",
    approvalRule: "Senior practitioner review recommended."
  },
  {
    id: "document-request-checklist",
    title: "Document request checklist",
    category: "document_checklist",
    source: "system_structure",
    reviewRequired: true,
    sharedPlatformLibrary: false,
    canPopulateFromWorkingDataPack: true,
    safePopulationRule: "Populate required/recommended/conditional items from the subclass document matrix only.",
    versioningRule: "Version when subclass matrix language changes.",
    approvalRule: "Agent review required before sending to client."
  }
];

export function mapGeneratedDocumentTypeToTemplate(type: GeneratedDocumentType): FirmTemplateLibraryItem {
  const base = systemPrecedentTemplates.find((item) => {
    if (type === GeneratedDocumentType.COVER_LETTER) return item.id === "cover-letter";
    if (type === GeneratedDocumentType.STATUTORY_DECLARATION_TEMPLATE) return item.id === "statutory-declaration";
    if (type === GeneratedDocumentType.DOCUMENT_REQUEST_CHECKLIST || type === GeneratedDocumentType.SKILLS_ASSESSMENT_CHECKLIST || type === GeneratedDocumentType.SPONSORSHIP_CHECKLIST) return item.id === "document-request-checklist";
    if (type === GeneratedDocumentType.CHARACTER_REFERENCE_TEMPLATE) return item.id === "character-health-response";
    if (type === GeneratedDocumentType.GENUINE_STUDENT_STATEMENT_OUTLINE) return item.id === "submission-outline";
    return false;
  });
  return base ?? systemPrecedentTemplates[0];
}

export function buildFirmTemplateLibraryView(input?: {
  firmProvidedPdfCount?: number;
  generatedTemplateCount?: number;
  invoiceTemplateCount?: number;
}) {
  const dynamicItems: FirmTemplateLibraryItem[] = [];
  if ((input?.firmProvidedPdfCount ?? 0) > 0) {
    dynamicItems.push({
      id: "firm-provided-pdf",
      title: `${input?.firmProvidedPdfCount ?? 0} firm-provided PDF template${input?.firmProvidedPdfCount === 1 ? "" : "s"}`,
      category: "official_form_pdf",
      source: "firm_provided",
      reviewRequired: true,
      sharedPlatformLibrary: false,
      canPopulateFromWorkingDataPack: true,
      safePopulationRule: "Map fillable fields from approved draft fields only; never include raw storage URLs.",
      versioningRule: "Upload a new template version when the firm PDF changes.",
      approvalRule: "Template mapping must be reviewed before generating a draft PDF."
    });
  }
  if ((input?.invoiceTemplateCount ?? 0) > 0) {
    dynamicItems.push({
      id: "invoice-template",
      title: `${input?.invoiceTemplateCount ?? 0} invoice template${input?.invoiceTemplateCount === 1 ? "" : "s"}`,
      category: "invoice",
      source: "workspace_generated",
      reviewRequired: true,
      sharedPlatformLibrary: false,
      canPopulateFromWorkingDataPack: false,
      safePopulationRule: "Use billing records and service pricing only; do not include private document contents.",
      versioningRule: "Keep invoice wording versions in workspace billing setup.",
      approvalRule: "Firm review required before sending."
    });
  }

  return {
    policy: firmTemplateLibraryPolicy,
    items: [...systemPrecedentTemplates, ...dynamicItems],
    generatedTemplateCount: input?.generatedTemplateCount ?? 0
  };
}
