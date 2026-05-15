export type AriaSubclassSupportLevel =
  | "FULL_FIELD_AUTOFILL"
  | "FULL_STAFF_DRAFT"
  | "CHECKLIST_AND_INTAKE"
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

function workflowSupport(input: {
  code: string;
  label: string;
  supportLevel: AriaSubclassSupportLevel;
  notes: string;
  officialFormState?: AriaSubclassSupport["officialFormState"];
}): AriaSubclassSupport {
  const fullDraft = input.supportLevel === "FULL_STAFF_DRAFT";
  const intake = input.supportLevel === "CHECKLIST_AND_INTAKE" || fullDraft;
  return {
    subclassCode: input.code,
    label: input.label,
    supportLevel: input.supportLevel,
    checklistTemplate: true,
    extractionSchemas: [],
    fieldLevelDraftKeys: fullDraft,
    aiDraftAutofill: fullDraft,
    clientConfirmationCategories: intake,
    safetyGate: intake,
    draftPack: intake,
    firmPdfTemplateMapping: fullDraft,
    matterReviewDashboard: intake,
    officialFormState: input.officialFormState ?? "PARTIAL",
    notes: input.notes
  };
}

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

const expandedWorkflowSupportMatrix: Record<string, AriaSubclassSupport> = {
  "590": workflowSupport({ code: "590", label: "Student Guardian visa (Subclass 590)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Document matrix, intake confirmations, and staff review preparation draft are configured. Full field-level autofill is not claimed." }),
  "407": workflowSupport({ code: "407", label: "Training visa (Subclass 407)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Training plan, sponsor/nomination, insurance, and police/health preparation matrix configured." }),
  "408": workflowSupport({ code: "408", label: "Temporary Activity visa (Subclass 408)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Temporary activity preparation matrix and review draft sections configured." }),
  "400": workflowSupport({ code: "400", label: "Temporary Work Short Stay Specialist (Subclass 400)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Specialist engagement, itinerary, financial, and employment preparation matrix configured." }),
  "300": workflowSupport({ code: "300", label: "Prospective Marriage visa (Subclass 300)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Prospective marriage relationship evidence workflow configured without guessed relationship narratives." }),
  "870": workflowSupport({ code: "870", label: "Sponsored Parent Temporary visa (Subclass 870)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Sponsor, parent-child relationship, financial/insurance, and declaration preparation workflow configured." }),
  "103": workflowSupport({ code: "103", label: "Parent visa (Subclass 103)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Parent visa preparation matrix configured; no full field-level autofill claim." }),
  "143": workflowSupport({ code: "143", label: "Contributory Parent visa (Subclass 143)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Parent visa preparation matrix configured; no full field-level autofill claim." }),
  "101": workflowSupport({ code: "101", label: "Child visa (Subclass 101)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Child visa identity, parent/sponsor, custody, and declaration preparation matrix configured." }),
  "802": workflowSupport({ code: "802", label: "Child visa onshore (Subclass 802)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Child visa identity, parent/sponsor, custody, and declaration preparation matrix configured." }),
  "188": workflowSupport({ code: "188", label: "Business Innovation and Investment visa (Subclass 188 legacy)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Legacy/support-mode business evidence preparation workflow configured; no full automation claim." }),
  "858": workflowSupport({ code: "858", label: "Global Talent / National Innovation style workflow (Subclass 858)", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Talent/business preparation matrix configured with agent-review narrative requirements." }),
  "494": workflowSupport({ code: "494", label: "Skilled Employer Sponsored Regional (Subclass 494)", supportLevel: "FULL_STAFF_DRAFT", notes: "Full staff-review draft structure configured with employer, regional, skills, English, safety, and declaration sections." }),
  "BRIDGING": workflowSupport({ code: "BRIDGING", label: "Bridging visa A/B/C/E preparation checklist", supportLevel: "CHECKLIST_ONLY", notes: "Checklist-only preparation support for bridging workflows; no full application-draft automation claim.", officialFormState: "ONLINE_ONLY" }),
  "REVIEW": workflowSupport({ code: "REVIEW", label: "AAT/ART review support pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Review support-pack workflow configured for chronology, issue summary, and evidence organisation." }),
  "MINISTERIAL": workflowSupport({ code: "MINISTERIAL", label: "Ministerial intervention support pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Support-pack workflow configured. Agent/legal strategy remains manual review." }),
  "PIC4020": workflowSupport({ code: "PIC4020", label: "PIC 4020 / natural justice response support pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Notice/response/evidence support pack configured; no legal conclusion is generated." }),
  "S56": workflowSupport({ code: "S56", label: "Section 56 request response pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Request, due date, requested evidence, outstanding item, and response workflow configured." }),
  "CHARACTER_RESPONSE": workflowSupport({ code: "CHARACTER_RESPONSE", label: "Character response support pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Character response support pack configured. Declarations remain client-confirmation and agent-review required." }),
  "HEALTH_WAIVER": workflowSupport({ code: "HEALTH_WAIVER", label: "Health waiver support pack", supportLevel: "CHECKLIST_AND_INTAKE", notes: "Health waiver support pack configured. Medical and legal conclusions remain manual review." })
};

const allSupportMatrix: Record<string, AriaSubclassSupport> = {
  ...subclassSupportMatrix,
  ...expandedWorkflowSupportMatrix
};

function normalizeSubclassCode(value: string) {
  const trimmed = value.trim();
  if (allSupportMatrix[trimmed]) return trimmed;
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  if (trimmed === "BVA" || trimmed === "BVB" || trimmed === "BVC" || trimmed === "BVE") return "BRIDGING";
  if (trimmed === "AAT" || trimmed === "ART") return "REVIEW";
  if (trimmed === "PIC 4020") return "PIC4020";
  if (trimmed.toUpperCase() === "SECTION 56") return "S56";
  return trimmed;
}

export function getSubclassSupport(subclassCode: string) {
  return allSupportMatrix[normalizeSubclassCode(subclassCode)] ?? {
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
  return Object.values(allSupportMatrix);
}

export function supportLevelLabel(level: AriaSubclassSupportLevel) {
  return level.replaceAll("_", " ").toLowerCase();
}
