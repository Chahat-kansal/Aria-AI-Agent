import { IssueSeverity } from "@prisma/client";
import { buildMatterClientConfirmationItems, type ClientConfirmationCategory, type ClientConfirmationItem } from "@/lib/services/client-confirmation";
import { redactEsignText } from "@/lib/services/esign/esign-redaction";

export type AcknowledgementRequestType =
  | "PERSONAL_DETAILS"
  | "HEALTH_CHARACTER"
  | "RELATIONSHIP_INFORMATION"
  | "FINANCIAL_SUPPORT"
  | "DOCUMENT_REQUEST_DETAILS"
  | "RETAINER_ACKNOWLEDGEMENT"
  | "GENERAL_CONFIRMATION";

export type AcknowledgementPrompt = {
  key: string;
  category: string;
  title: string;
  detail: string;
  required: boolean;
  highImpact: boolean;
};

export type AcknowledgementDefinition = {
  requestType: AcknowledgementRequestType;
  title: string;
  safeSummary: string;
  clientNotice: string;
  prompts: AcknowledgementPrompt[];
  requiresRetainerTemplate: boolean;
};

export type SubmittedAcknowledgementAnswer = {
  key: string;
  title: string;
  response: "confirmed" | "needs_agent_follow_up";
  detail: string;
  highImpact: boolean;
};

export type SubmittedAcknowledgementPayload = {
  statementAccepted: boolean;
  submittedAt: string;
  requestType: AcknowledgementRequestType;
  answers: SubmittedAcknowledgementAnswer[];
};

export type AcknowledgementRiskFlag = {
  code: string;
  title: string;
  description: string;
  severity: IssueSeverity;
};

function pickCategories(requestType: AcknowledgementRequestType): ClientConfirmationCategory[] {
  switch (requestType) {
    case "PERSONAL_DETAILS":
      return ["personal_details", "document_accuracy"];
    case "HEALTH_CHARACTER":
      return ["health_declaration", "character_declaration"];
    case "RELATIONSHIP_INFORMATION":
      return ["relationship_family"];
    case "FINANCIAL_SUPPORT":
      return ["financial_capacity", "employment", "insurance"];
    case "DOCUMENT_REQUEST_DETAILS":
      return ["document_accuracy"];
    case "GENERAL_CONFIRMATION":
    case "RETAINER_ACKNOWLEDGEMENT":
    default:
      return [];
  }
}

function fallbackPrompts(requestType: AcknowledgementRequestType): AcknowledgementPrompt[] {
  const common = {
    required: true,
    highImpact: requestType !== "DOCUMENT_REQUEST_DETAILS"
  };
  switch (requestType) {
    case "PERSONAL_DETAILS":
      return [{
        key: "personal_details.confirm",
        category: "personal_details",
        title: "Confirm your personal details",
        detail: "Confirm that your current personal details are correct and tell your migration team if anything needs correction.",
        ...common
      }];
    case "HEALTH_CHARACTER":
      return [{
        key: "health_character.confirm",
        category: "health_character",
        title: "Confirm health and character declarations",
        detail: "Confirm whether anything about your health, police history, refusals, cancellations, or compliance history needs agent follow-up.",
        ...common
      }];
    case "RELATIONSHIP_INFORMATION":
      return [{
        key: "relationship.confirm",
        category: "relationship",
        title: "Confirm relationship information",
        detail: "Confirm the relationship dates, family details, and supporting documents your migration team should rely on.",
        ...common
      }];
    case "FINANCIAL_SUPPORT":
      return [{
        key: "financial.confirm",
        category: "financial_capacity",
        title: "Confirm financial and support details",
        detail: "Confirm your funding source, support arrangements, and whether any financial evidence needs clarification.",
        ...common
      }];
    case "DOCUMENT_REQUEST_DETAILS":
      return [{
        key: "documents.confirm",
        category: "document_accuracy",
        title: "Confirm document request details",
        detail: "Confirm that you understand which documents your migration team has requested and which details still need review.",
        required: true,
        highImpact: false
      }];
    case "RETAINER_ACKNOWLEDGEMENT":
      return [{
        key: "retainer.confirm",
        category: "retainer",
        title: "Confirm retainer acknowledgement",
        detail: "Confirm that you have read the engagement terms and will contact your migration team if anything is unclear.",
        ...common
      }];
    case "GENERAL_CONFIRMATION":
    default:
      return [{
        key: "general.confirm",
        category: "general",
        title: "Confirm the requested information",
        detail: "Confirm the details requested by your migration team and note anything that still needs follow-up.",
        required: true,
        highImpact: false
      }];
  }
}

function mapItemsToPrompts(items: ClientConfirmationItem[]): AcknowledgementPrompt[] {
  return items.map((item) => ({
    key: item.key,
    category: item.category,
    title: item.title,
    detail: item.detail,
    required: item.status === "required",
    highImpact: /health|character|relationship|financial|employment|insurance/i.test(item.category)
  }));
}

export async function buildAcknowledgementDefinition(input: {
  matterId: string;
  requestType: AcknowledgementRequestType;
  title?: string | null;
  customStatement?: string | null;
}) {
  const confirmationItems = await buildMatterClientConfirmationItems(input.matterId).catch(() => []);
  const categories = pickCategories(input.requestType);
  const prompts = categories.length
    ? mapItemsToPrompts(confirmationItems.filter((item) => categories.includes(item.category)))
    : [];
  const finalPrompts = prompts.length ? prompts : fallbackPrompts(input.requestType);

  const title = input.title?.trim() || ({
    PERSONAL_DETAILS: "Personal details confirmation",
    HEALTH_CHARACTER: "Health and character declaration confirmation",
    RELATIONSHIP_INFORMATION: "Relationship information confirmation",
    FINANCIAL_SUPPORT: "Financial capacity confirmation",
    DOCUMENT_REQUEST_DETAILS: "Document request detail confirmation",
    RETAINER_ACKNOWLEDGEMENT: "Retainer acknowledgement",
    GENERAL_CONFIRMATION: "Client acknowledgement / confirmation"
  } satisfies Record<AcknowledgementRequestType, string>)[input.requestType];

  return {
    requestType: input.requestType,
    title,
    safeSummary: redactEsignText(input.customStatement) || title,
    clientNotice: input.customStatement?.trim() || "Your migration team will review this before use. This confirmation does not lodge an application. Contact your migration agent if anything is incorrect.",
    prompts: finalPrompts,
    requiresRetainerTemplate: input.requestType === "RETAINER_ACKNOWLEDGEMENT"
  } satisfies AcknowledgementDefinition;
}

export function parseAcknowledgementSubmission(formData: FormData, definition: AcknowledgementDefinition): SubmittedAcknowledgementPayload {
  return {
    statementAccepted: String(formData.get("statementAccepted") || "") === "on",
    submittedAt: new Date().toISOString(),
    requestType: definition.requestType,
    answers: definition.prompts.map((prompt) => ({
      key: prompt.key,
      title: prompt.title,
      response: String(formData.get(`response__${prompt.key}`) || "") === "needs_agent_follow_up" ? "needs_agent_follow_up" : "confirmed",
      detail: String(formData.get(`detail__${prompt.key}`) || "").trim(),
      highImpact: prompt.highImpact
    }))
  };
}

export function detectAcknowledgementRiskFlags(payload: SubmittedAcknowledgementPayload) {
  const flags: AcknowledgementRiskFlag[] = [];
  for (const answer of payload.answers) {
    const lowered = answer.detail.toLowerCase();
    if (answer.response === "needs_agent_follow_up") {
      flags.push({
        code: `${answer.key}.follow_up`,
        title: `${answer.title} requires agent follow-up`,
        description: "The client indicated that this acknowledgement item still needs migration agent review.",
        severity: answer.highImpact ? IssueSeverity.HIGH : IssueSeverity.MEDIUM
      });
    }
    if (/health|medical/.test(lowered)) {
      flags.push({
        code: "health_issue_disclosed",
        title: "Health issue disclosed",
        description: "The client submitted a health-related disclosure that remains review-required.",
        severity: IssueSeverity.HIGH
      });
    }
    if (/police|criminal|charge|convict|refusal|cancel/.test(lowered)) {
      flags.push({
        code: "character_issue_disclosed",
        title: "Character or compliance issue disclosed",
        description: "The client submitted a refusal, cancellation, police, or character-related disclosure that remains review-required.",
        severity: IssueSeverity.HIGH
      });
    }
    if (/relationship|marriage|separat|divorce|partner/.test(lowered) && answer.highImpact) {
      flags.push({
        code: "relationship_detail_conflict",
        title: "Relationship detail needs review",
        description: "Relationship information needs direct migration agent review before it is relied upon.",
        severity: IssueSeverity.MEDIUM
      });
    }
    if (/bank|fund|borrow|loan|sponsor|cash/.test(lowered) && /unclear|not sure|different|changed/.test(lowered)) {
      flags.push({
        code: "financial_source_unclear",
        title: "Financial source needs clarification",
        description: "The funding source or support arrangement appears unclear and remains review-required.",
        severity: IssueSeverity.MEDIUM
      });
    }
  }
  return flags.filter((flag, index, array) => array.findIndex((item) => item.code === flag.code) === index);
}

export function assertInternalAcknowledgementWording(content: string) {
  return !/legally binding/i.test(content);
}
