import type { AriaEvidenceSource, AriaGroundedResponse } from "@/lib/services/aria-evidence";
import { buildGroundedResponse, clampConfidence } from "@/lib/services/aria-evidence";

export type AssistantGroundedPayload = {
  content: string;
  evidence: AriaEvidenceSource[];
  assumptions: string[];
  missingInformation: string[];
  confidence: number;
  reviewRequired: true;
  recommendedActions: string[];
  warnings: string[];
  groundedFacts: string[];
  reasoning: string[];
  citations: Array<{ label: string; href: string }>;
  riskWarnings: string[];
  configured?: boolean;
  setup?: string;
  error?: string;
};

export function groundedResponseToAssistantPayload(
  response: AriaGroundedResponse,
  extras?: Partial<AssistantGroundedPayload>
): AssistantGroundedPayload {
  const warnings = Array.from(new Set([...(response.warnings ?? []), ...(extras?.warnings ?? [])]));
  return {
    content: response.answer,
    evidence: response.evidence,
    assumptions: response.assumptions,
    missingInformation: response.missingInformation,
    confidence: clampConfidence(response.confidence),
    reviewRequired: true,
    recommendedActions: response.recommendedActions,
    warnings,
    groundedFacts: extras?.groundedFacts ?? response.evidence.map((item) => item.title).slice(0, 8),
    reasoning: extras?.reasoning ?? [],
    citations: extras?.citations ?? response.evidence
      .filter((item) => item.url)
      .slice(0, 8)
      .map((item) => ({ label: item.title, href: item.url! })),
    riskWarnings: extras?.riskWarnings ?? warnings,
    configured: extras?.configured,
    setup: extras?.setup,
    error: extras?.error
  };
}

export function buildFallbackGroundedAssistantPayload(input: {
  answer: string;
  evidence?: AriaEvidenceSource[];
  assumptions?: string[];
  missingInformation?: string[];
  confidence?: number;
  recommendedActions?: string[];
  warnings?: string[];
  groundedFacts?: string[];
  reasoning?: string[];
  citations?: Array<{ label: string; href: string }>;
}): AssistantGroundedPayload {
  const grounded = buildGroundedResponse({
    answer: input.answer,
    evidence: input.evidence,
    assumptions: input.assumptions,
    missingInformation: input.missingInformation,
    confidence: input.confidence,
    recommendedActions: input.recommendedActions,
    warnings: input.warnings,
    reviewRequired: true
  });
  return groundedResponseToAssistantPayload(grounded, {
    groundedFacts: input.groundedFacts,
    reasoning: input.reasoning,
    citations: input.citations
  });
}
