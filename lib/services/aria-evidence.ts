export type AriaEvidenceSourceType =
  | "DOCUMENT"
  | "CLIENT_PROFILE"
  | "MATTER"
  | "DRAFT_FIELD"
  | "OFFICIAL_UPDATE"
  | "MIGRATION_INTEL"
  | "CHECKLIST"
  | "FORM_TEMPLATE"
  | "AGENT_NOTE"
  | "SYSTEM";

export type AriaEvidenceReliability =
  | "OFFICIAL"
  | "CLIENT_SUPPLIED"
  | "AGENT_ENTERED"
  | "AI_EXTRACTED"
  | "NEWS_INTEL"
  | "SYSTEM_DERIVED";

export type AriaEvidenceSource = {
  sourceType: AriaEvidenceSourceType;
  sourceId?: string;
  title: string;
  snippet?: string;
  url?: string;
  confidence?: number;
  reliability: AriaEvidenceReliability;
};

export type AriaGroundedResponse = {
  answer: string;
  evidence: AriaEvidenceSource[];
  assumptions: string[];
  missingInformation: string[];
  confidence: number;
  reviewRequired: boolean;
  recommendedActions: string[];
  warnings: string[];
};

export function clampConfidence(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

export function evidenceLabel(reliability: AriaEvidenceReliability) {
  switch (reliability) {
    case "OFFICIAL":
      return "OFFICIAL";
    case "NEWS_INTEL":
      return "NEWS / MIGRATION INTEL";
    case "CLIENT_SUPPLIED":
      return "CLIENT SUPPLIED";
    case "AGENT_ENTERED":
      return "AGENT ENTERED";
    case "AI_EXTRACTED":
      return "AI EXTRACTED";
    case "SYSTEM_DERIVED":
    default:
      return "SYSTEM GENERATED";
  }
}

export function sourceTypeToReliability(sourceType: string | null | undefined): AriaEvidenceReliability {
  switch ((sourceType || "").toUpperCase()) {
    case "OFFICIAL":
      return "OFFICIAL";
    case "NEWS":
    case "AI_SUMMARY":
      return "NEWS_INTEL";
    case "FIRM_NOTE":
      return "AGENT_ENTERED";
    default:
      return "SYSTEM_DERIVED";
  }
}

export function buildGroundedResponse(input: Partial<AriaGroundedResponse> & Pick<AriaGroundedResponse, "answer">): AriaGroundedResponse {
  return {
    answer: input.answer,
    evidence: input.evidence ?? [],
    assumptions: input.assumptions ?? [],
    missingInformation: input.missingInformation ?? [],
    confidence: clampConfidence(input.confidence ?? 0.65),
    reviewRequired: input.reviewRequired ?? true,
    recommendedActions: input.recommendedActions ?? [],
    warnings: input.warnings ?? []
  };
}
