export type AriaSubclassSupportLevel =
  | "FULL_FIELD_AUTOFILL"
  | "CHECKLIST_AND_DRAFT_PACK"
  | "CHECKLIST_ONLY"
  | "ONLINE_ONLY"
  | "NOT_CONFIGURED";

export type AriaSubclassSupport = {
  subclassCode: string;
  label: string;
  supportLevel: AriaSubclassSupportLevel;
  checklistTemplate: boolean;
  extractionSchemas: string[];
  fieldLevelDraftKeys: boolean;
  aiDraftAutofill: boolean;
  clientConfirmationCategories: boolean;
  safetyGate: boolean;
  draftPack: boolean;
  firmPdfTemplateMapping: boolean;
  matterReviewDashboard: boolean;
  officialFormState: "SUPPORTED" | "ONLINE_ONLY" | "PARTIAL" | "NOT_CONFIGURED";
  notes: string;
};

const subclassSupportMatrix: Record<string, AriaSubclassSupport> = {
  "500": {
    subclassCode: "500",
    label: "Student visa (Subclass 500)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "COE", "PTE", "IELTS", "BANK_STATEMENT", "STATEMENT"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Most complete end-to-end workflow: evidence review, field-level autofill, client confirmation, safety gate, draft pack, and mapped PDF drafts."
  },
  "485": {
    subclassCode: "485",
    label: "Temporary Graduate visa (Subclass 485)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "VISA_GRANT", "IELTS", "PTE", "POLICE_CLEARANCE", "OTHER"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist, draft pack, mapped PDFs, and safety/client confirmation are supported. Dedicated field-level autofill is not configured yet."
  },
  "482": {
    subclassCode: "482",
    label: "Skills in Demand / TSS (Subclass 482)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "IELTS", "PTE", "EMPLOYMENT_REFERENCE", "RESUME", "PAYSLIP"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist and draft pack are available. Field-level autofill remains narrower than Subclass 500."
  },
  "186": {
    subclassCode: "186",
    label: "Employer Nomination Scheme (Subclass 186)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "EMPLOYMENT_REFERENCE", "RESUME"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist, safety gate, draft pack, and firm-template mapping are supported. Dedicated autofill is not."
  },
  "820/801": {
    subclassCode: "820/801",
    label: "Partner visa (Subclass 820/801)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE", "POLICE_CLEARANCE", "STATEMENT"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Relationship evidence and draft pack support exist, but no field-level relationship autofill is configured."
  },
  "309/100": {
    subclassCode: "309/100",
    label: "Partner visa (Subclass 309/100)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE", "POLICE_CLEARANCE", "STATEMENT"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist, relationship client confirmation, safety gate, and draft pack support are present. Dedicated field-level autofill is not configured."
  },
  "189": {
    subclassCode: "189",
    label: "Skilled Independent visa (Subclass 189)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "EMPLOYMENT_REFERENCE"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist, draft pack, and skilled-points/safety context are supported. Field-level autofill is not configured."
  },
  "190": {
    subclassCode: "190",
    label: "Skilled Nominated visa (Subclass 190)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "EMPLOYMENT_REFERENCE"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist and skilled-migration support exist, but field-level draft autofill is not configured."
  },
  "491": {
    subclassCode: "491",
    label: "Skilled Work Regional visa (Subclass 491)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "EMPLOYMENT_REFERENCE"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist and skilled/regional draft pack support are present, but no dedicated field-level autofill workflow exists."
  },
  "600": {
    subclassCode: "600",
    label: "Visitor visa (Subclass 600)",
    supportLevel: "CHECKLIST_AND_DRAFT_PACK",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "BANK_STATEMENT", "STATEMENT", "OTHER"],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Checklist, visitor draft pack, client confirmation, and safety gate are available. Field-level autofill is not configured."
  }
};

function normalizeSubclassCode(value: string) {
  const trimmed = value.trim();
  if (subclassSupportMatrix[trimmed]) return trimmed;
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  return trimmed;
}

export function getSubclassSupport(subclassCode: string) {
  return subclassSupportMatrix[normalizeSubclassCode(subclassCode)] ?? {
    subclassCode,
    label: `Subclass ${subclassCode}`,
    supportLevel: "NOT_CONFIGURED" as const,
    checklistTemplate: false,
    extractionSchemas: [],
    fieldLevelDraftKeys: false,
    aiDraftAutofill: false,
    clientConfirmationCategories: false,
    safetyGate: false,
    draftPack: false,
    firmPdfTemplateMapping: false,
    matterReviewDashboard: false,
    officialFormState: "NOT_CONFIGURED" as const,
    notes: "No subclass-specific support metadata is configured yet."
  };
}

export function listSubclassSupport() {
  return Object.values(subclassSupportMatrix);
}

export function supportLevelLabel(level: AriaSubclassSupportLevel) {
  return level.replaceAll("_", " ").toLowerCase();
}
