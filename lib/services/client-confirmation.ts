import { DraftFieldStatus, IssueSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/security/encryption";

export type ClientConfirmationCategory =
  | "personal_details"
  | "document_accuracy"
  | "health_declaration"
  | "character_declaration"
  | "relationship_family"
  | "study_gte"
  | "financial_capacity"
  | "employment"
  | "insurance";

export type ClientConfirmationItem = {
  key: string;
  category: ClientConfirmationCategory;
  title: string;
  detail: string;
  status: "required" | "recommended";
};

export type ClientConfirmationPrompt = ClientConfirmationItem & {
  responseKey: string;
  detailKey: string;
};

export type SubmittedClientConfirmation = {
  key: string;
  category: ClientConfirmationCategory;
  title: string;
  status: "required" | "recommended";
  response: "confirmed" | "needs_agent_follow_up";
  detail: string;
};

export type SubmittedClientConfirmationPayload = {
  schemaVersion: 1;
  submittedAt: string;
  items: SubmittedClientConfirmation[];
};

type MatterConfirmationContext = {
  visaSubclass: string;
  requiredFields: Array<{ fieldKey: string; label: string; status: DraftFieldStatus }>;
  openIssues: Array<{ title: string; description: string; severity: IssueSeverity; relatedFieldKey: string | null }>;
};

function categoryLabel(category: ClientConfirmationCategory) {
  switch (category) {
    case "personal_details":
      return "Personal details confirmation";
    case "document_accuracy":
      return "Document accuracy confirmation";
    case "health_declaration":
      return "Health declaration confirmation";
    case "character_declaration":
      return "Character declaration confirmation";
    case "relationship_family":
      return "Relationship / family confirmation";
    case "study_gte":
      return "Study / genuine student confirmation";
    case "financial_capacity":
      return "Financial capacity confirmation";
    case "employment":
      return "Employment confirmation";
    case "insurance":
      return "Insurance confirmation";
  }
}

function uniqueItems(items: ClientConfirmationItem[]) {
  return items.filter((item, index) =>
    items.findIndex((candidate) => candidate.key === item.key) === index
  );
}

function buildItemsFromContext(context: MatterConfirmationContext) {
  const items: ClientConfirmationItem[] = [];

  for (const field of context.requiredFields) {
    if (field.status === DraftFieldStatus.MISSING || field.status === DraftFieldStatus.CONFLICTING) {
      if (/passport|date_of_birth|dob|nationality|country_of_birth|place_of_birth/i.test(field.fieldKey)) {
        items.push({
          key: `confirm.${field.fieldKey}`,
          category: "personal_details",
          title: `Confirm ${field.label.toLowerCase()}`,
          detail: `${field.label} is still unresolved or conflicting. Confirm the exact value directly against the client's current identity document.`,
          status: "required"
        });
      }

      if (/passport|identity|document/i.test(field.fieldKey)) {
        items.push({
          key: `document.${field.fieldKey}`,
          category: "document_accuracy",
          title: `Confirm source document accuracy for ${field.label.toLowerCase()}`,
          detail: "Confirm that the uploaded source document is current, complete, and belongs to the correct applicant.",
          status: "recommended"
        });
      }

      if (/funds|financial/i.test(field.fieldKey)) {
        items.push({
          key: `financial.${field.fieldKey}`,
          category: "financial_capacity",
          title: "Confirm financial capacity evidence",
          detail: "Confirm the source of funds, amount available, and whether the uploaded financial evidence is still accurate and complete.",
          status: "required"
        });
      }

      if (/employment|employer|occupation/i.test(field.fieldKey)) {
        items.push({
          key: `employment.${field.fieldKey}`,
          category: "employment",
          title: "Confirm employment history details",
          detail: "Confirm roles, dates, employers, and any gaps or sponsor relationships that the migration agent needs to rely on.",
          status: "required"
        });
      }

      if (/oshc|ovhc|insurance/i.test(field.fieldKey)) {
        items.push({
          key: `insurance.${field.fieldKey}`,
          category: "insurance",
          title: "Confirm insurance coverage details",
          detail: "Confirm the insurer, policy period, and whether the uploaded policy still covers the relevant study or stay period.",
          status: "required"
        });
      }
    }

    if (field.fieldKey === "statement.genuine_student") {
      items.push({
        key: "statement.genuine_student",
        category: "study_gte",
        title: "Confirm genuine student statement details",
        detail: "Confirm study rationale, provider choice, future plans, and relevant home-country ties. Aria must not infer this without the client's own instructions.",
        status: "required"
      });
    }

    if (field.fieldKey === "health.declarations") {
      items.push({
        key: "health.declarations",
        category: "health_declaration",
        title: "Confirm health declarations",
        detail: "Confirm any current health issues, examinations, treatment history, or related disclosures for agent review.",
        status: "required"
      });
    }

    if (field.fieldKey === "character.declarations") {
      items.push({
        key: "character.declarations",
        category: "character_declaration",
        title: "Confirm character declarations",
        detail: "Confirm any refusals, cancellations, overstays, police matters, charges, or convictions before the matter moves to final review.",
        status: "required"
      });
    }
  }

  for (const issue of context.openIssues) {
    if (/relationship|partner|spouse|family/i.test(issue.title) || /relationship|partner|family/i.test(issue.relatedFieldKey ?? "")) {
      items.push({
        key: "relationship.family",
        category: "relationship_family",
        title: "Confirm relationship and family details",
        detail: "Confirm family composition, partner details, dependants, and any relationship timeline evidence that still needs direct client confirmation.",
        status: issue.severity === IssueSeverity.HIGH || issue.severity === IssueSeverity.CRITICAL ? "required" : "recommended"
      });
    }
  }

  if (context.visaSubclass === "500") {
    items.push({
      key: "study.gte",
      category: "study_gte",
      title: "Confirm study and genuine student factors",
      detail: "Confirm course choice, study pathway, future plans, and any facts the migration agent should rely on for the student's circumstances.",
      status: "recommended"
    });
    items.push({
      key: "insurance.oshc",
      category: "insurance",
      title: "Confirm OSHC coverage period",
      detail: "Confirm that the health insurance policy dates and provider details match the intended study period.",
      status: "recommended"
    });
  }

  return uniqueItems(items);
}

export async function buildMatterClientConfirmationItems(matterId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      validationIssues: { orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      applicationDrafts: {
        include: {
          fields: {
            include: { templateField: true },
            orderBy: { templateField: { sortOrder: "asc" } }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 1
      }
    }
  });

  const draft = matter.applicationDrafts[0];
  const requiredFields = draft?.fields
    .filter((field) => field.templateField.required)
    .map((field) => ({
      fieldKey: field.templateField.fieldKey,
      label: field.templateField.label,
      status: field.status as DraftFieldStatus
    })) ?? [];

  const openIssues = matter.validationIssues
    .filter((issue) => issue.resolutionStatus !== "RESOLVED")
    .map((issue) => ({
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      relatedFieldKey: issue.relatedFieldKey
    }));

  return buildItemsFromContext({
    visaSubclass: matter.visaSubclass,
    requiredFields,
    openIssues
  });
}

export const buildClientConfirmationItems = buildMatterClientConfirmationItems;

export function buildClientConfirmationPrompts(items: ClientConfirmationItem[]): ClientConfirmationPrompt[] {
  return items.map((item) => ({
    ...item,
    responseKey: `confirmation_response__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`,
    detailKey: `confirmation_detail__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`
  }));
}

export function buildClientConfirmationMessage(items: ClientConfirmationItem[]) {
  if (!items.length) {
    return "Please review and confirm any outstanding declarations or client-provided details that your migration agent may still need before final review.";
  }

  const grouped = items.reduce<Record<ClientConfirmationCategory, ClientConfirmationItem[]>>((acc, item) => {
    acc[item.category] ||= [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<ClientConfirmationCategory, ClientConfirmationItem[]>);

  return [
    "Your migration team needs you to confirm the following items before the matter can move to final review:",
    "",
    ...Object.entries(grouped).flatMap(([category, categoryItems]) => [
      `${categoryLabel(category as ClientConfirmationCategory)}:`,
      ...categoryItems.map((item, index) => `  ${index + 1}. ${item.title} - ${item.detail}`),
      ""
    ]),
    "Please answer carefully and provide only accurate information. Your registered migration agent will review everything before it is used."
  ].join("\n");
}

export function parseSubmittedClientConfirmations(
  formData: FormData,
  items: ClientConfirmationItem[]
): SubmittedClientConfirmationPayload | null {
  if (!items.length) return null;
  const prompts = buildClientConfirmationPrompts(items);
  const submittedItems = prompts.map((prompt) => ({
    key: prompt.key,
    category: prompt.category,
    title: prompt.title,
    status: prompt.status,
    response: (String(formData.get(prompt.responseKey) || "") === "needs_agent_follow_up"
      ? "needs_agent_follow_up"
      : "confirmed") as "confirmed" | "needs_agent_follow_up",
    detail: String(formData.get(prompt.detailKey) || "").trim()
  }));

  return {
    schemaVersion: 1,
    submittedAt: new Date().toISOString(),
    items: submittedItems
  };
}

export function readSubmittedClientConfirmations(value: Prisma.JsonValue | null | undefined): SubmittedClientConfirmationPayload | null {
  if (!value) return null;
  const payload = typeof value === "string" ? decryptJson<unknown>(value) : value;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;
  return {
    schemaVersion: 1,
    submittedAt: typeof record.submittedAt === "string" ? record.submittedAt : new Date(0).toISOString(),
    items: record.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item) => ({
        key: String(item.key || ""),
        category: String(item.category || "document_accuracy") as ClientConfirmationCategory,
        title: String(item.title || ""),
        status: String(item.status || "recommended") === "required" ? "required" : "recommended",
        response: (String(item.response || "confirmed") === "needs_agent_follow_up" ? "needs_agent_follow_up" : "confirmed") as "confirmed" | "needs_agent_follow_up",
        detail: String(item.detail || "")
      }))
  };
}
