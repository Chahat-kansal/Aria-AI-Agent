export type FullDraftMarker =
  | "MISSING"
  | "NOT_FOUND_IN_APPROVED_EVIDENCE"
  | "SOURCE_REQUIRED"
  | "CLIENT_CONFIRMATION_REQUIRED"
  | "AGENT_REVIEW_REQUIRED"
  | "AGENT_TO_INSERT_NARRATIVE"
  | "CONFLICTING_EVIDENCE"
  | "VERIFIED"
  | "APPROVED_FOR_AI";

export type FullDraftDocumentRequirementStatus =
  | "REQUIRED"
  | "RECOMMENDED"
  | "CONDITIONAL";

export type FullDraftDocumentRequirement = {
  key: string;
  label: string;
  category: string;
  status: FullDraftDocumentRequirementStatus;
  description?: string;
  keywords: string[];
  clientConfirmationCategory?: string;
};

export type FullDraftDocumentRequirementResult = FullDraftDocumentRequirement & {
  uploaded: boolean;
  extracted: boolean;
  approvedForAiWorkingCopy: boolean;
  clientConfirmationRequired: boolean;
  matchedDocuments: Array<{
    id: string;
    fileName: string;
    category: string;
    extractionStatus: string;
    reviewStatus: string;
  }>;
};

export type FullDraftFieldTemplate = {
  key: string;
  label: string;
  aliases?: string[];
  required?: boolean;
  sourceRequired?: boolean;
  unsafe?: boolean;
  clientConfirmationCategory?: string;
  agentNarrative?: boolean;
  fallback?: "client" | "matter" | "workspace" | "agent";
};

export type FullDraftSectionTemplate = {
  key: string;
  title: string;
  description?: string;
  fields: FullDraftFieldTemplate[];
};

export type FullApplicationDraftTemplate = {
  subclassCodes: string[];
  title: string;
  documentRequirements: FullDraftDocumentRequirement[];
  sections: FullDraftSectionTemplate[];
};

export type FullDraftField = {
  key: string;
  label: string;
  value: string;
  sourceDocument?: string;
  sourceType: string;
  sourceReference?: string;
  confidence?: number;
  status: string;
  markers: FullDraftMarker[];
};

export type FullDraftSection = {
  key: string;
  title: string;
  description?: string;
  fields: FullDraftField[];
};

export type FullApplicationDraft = {
  matterId: string;
  title: string;
  generatedAt: string;
  generatedBy: string;
  canGenerate: boolean;
  notEnoughEvidenceReason?: string;
  disclaimer: string;
  cover: Array<{ label: string; value: string }>;
  actionFlags: Array<{ severity: "hard" | "soft" | "info"; title: string; detail: string }>;
  documentMatrix: FullDraftDocumentRequirementResult[];
  sections: FullDraftSection[];
  safety: {
    status: "Ready for agent final review" | "Blocked - missing critical evidence";
    hardBlockers: string[];
    softBlockers: string[];
    recommendedActions: string[];
  };
};

export type FullDraftContext = {
  matter: {
    id: string;
    reference?: string | null;
    title: string;
    visaSubclass: string;
    visaStream?: string | null;
    stage?: string | null;
    status?: string | null;
    readinessScore?: number | null;
    currentVisaStatus?: string | null;
    currentVisaExpiry?: Date | string | null;
  };
  client: {
    firstName: string;
    lastName: string;
    dob?: Date | string | null;
    nationality?: string | null;
    email?: string | null;
    phone?: string | null;
    currentVisaStatus?: string | null;
    currentVisaExpiry?: Date | string | null;
  };
  workspace: {
    name: string;
    legalName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  };
  agent?: {
    name?: string | null;
    email?: string | null;
    jobTitle?: string | null;
    notes?: string | null;
  };
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    extractionStatus: string;
    reviewStatus: string;
  }>;
  draftFields: Array<{
    key: string;
    label: string;
    value?: string | null;
    manualOverride?: string | null;
    status: string;
    confidence?: number | null;
    sourceSnippet?: string | null;
    sourcePageRef?: string | null;
    sourceDocument?: string | null;
  }>;
  clientConfirmationItems: Array<{ category: string; label: string; status?: string }>;
  safety?: {
    readyForAgentFinalReview: boolean;
    hardBlockers: Array<{ title: string; detail?: string }>;
    softBlockers: Array<{ title: string; detail?: string }>;
    recommendedActions: string[];
  };
};
