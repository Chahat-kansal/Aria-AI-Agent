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
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "CURRENT_VISA_EVIDENCE", "VISA_GRANT", "COMPLETION_LETTER", "TRANSCRIPT", "IELTS", "PTE", "TOEFL_OET", "AFP_CHECK", "HEALTH_INSURANCE_POLICY"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers identity, current visa, qualification, English, AFP/insurance, and unsafe declaration handling with source-backed review status."
  },
  "482": {
    subclassCode: "482",
    label: "Skills in Demand / TSS (Subclass 482)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "IELTS", "PTE", "TOEFL_OET", "EMPLOYMENT_REFERENCE", "EMPLOYMENT_CONTRACT", "RESUME", "PAYSLIP", "SPONSOR_NOMINATION"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers sponsor, nomination, employment contract, salary, occupation, dependants, and declaration-safe review paths."
  },
  "186": {
    subclassCode: "186",
    label: "Employer Nomination Scheme (Subclass 186)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "EMPLOYMENT_REFERENCE", "EMPLOYMENT_CONTRACT", "RESUME", "SPONSOR_NOMINATION"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers employer, nomination, stream, role, salary, contract, work history, and declaration-safe review handling."
  },
  "820/801": {
    subclassCode: "820/801",
    label: "Partner visa (Subclass 820/801)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE", "CITIZENSHIP_CERTIFICATE", "FORM_888", "RELATIONSHIP_STATEMENT", "POLICE_CLEARANCE", "STATEMENT"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers sponsor identity/status, relationship chronology, cohabitation, social/financial/household evidence, witnesses, and declaration-safe review handling."
  },
  "309/100": {
    subclassCode: "309/100",
    label: "Partner visa (Subclass 309/100)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "MARRIAGE_CERTIFICATE", "BIRTH_CERTIFICATE", "CITIZENSHIP_CERTIFICATE", "FORM_888", "RELATIONSHIP_STATEMENT", "INVITATION_LETTER", "TRAVEL_ITINERARY", "POLICE_CLEARANCE", "STATEMENT"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers offshore partner evidence, sponsor identity, communication/travel history, witness support, and declaration-safe review handling."
  },
  "189": {
    subclassCode: "189",
    label: "Skilled Independent visa (Subclass 189)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "TOEFL_OET", "EMPLOYMENT_REFERENCE", "PAYSLIP", "TAX_SUPER_EVIDENCE", "TRANSCRIPT"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers skills assessment, occupation, points claims, employment evidence, English evidence, and source-backed review status."
  },
  "190": {
    subclassCode: "190",
    label: "Skilled Nominated visa (Subclass 190)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "TOEFL_OET", "EMPLOYMENT_REFERENCE", "PAYSLIP", "TAX_SUPER_EVIDENCE", "STATE_NOMINATION"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers skilled points, skills assessment, employment evidence, and nomination-backed claims for Subclass 190."
  },
  "491": {
    subclassCode: "491",
    label: "Skilled Work Regional visa (Subclass 491)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "SKILLS_ASSESSMENT", "IELTS", "PTE", "TOEFL_OET", "EMPLOYMENT_REFERENCE", "PAYSLIP", "TAX_SUPER_EVIDENCE", "STATE_NOMINATION"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers regional nomination/sponsorship evidence, skilled points, employment support, and source-backed review status."
  },
  "600": {
    subclassCode: "600",
    label: "Visitor visa (Subclass 600)",
    supportLevel: "FULL_FIELD_AUTOFILL",
    checklistTemplate: true,
    extractionSchemas: ["PASSPORT", "BANK_STATEMENT", "INVITATION_LETTER", "TRAVEL_ITINERARY", "EMPLOYMENT_REFERENCE", "STATEMENT", "OTHER"],
    fieldLevelDraftKeys: true,
    aiDraftAutofill: true,
    clientConfirmationCategories: true,
    safetyGate: true,
    draftPack: true,
    firmPdfTemplateMapping: true,
    matterReviewDashboard: true,
    officialFormState: "PARTIAL",
    notes: "Field-level autofill now covers travel plans, visitor purpose, financial support, home ties, and declaration-safe review handling."
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
