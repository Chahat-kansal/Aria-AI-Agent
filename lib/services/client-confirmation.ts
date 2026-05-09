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
  | "insurance"
  | "visitor_travel_home_ties"
  | "skilled_points"
  | "sponsor_nomination";

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
    case "visitor_travel_home_ties":
      return "Visitor travel purpose / home ties confirmation";
    case "skilled_points":
      return "Skilled points claim confirmation";
    case "sponsor_nomination":
      return "Sponsor / nomination confirmation";
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

  if (context.visaSubclass === "485") {
    items.push(
      {
        key: "485.current_visa",
        category: "document_accuracy",
        title: "Confirm current visa and grant details",
        detail: "Confirm the applicant's current visa status, grant details, expiry, and any recent changes that the migration agent should rely on.",
        status: "required"
      },
      {
        key: "485.english_skills",
        category: "study_gte",
        title: "Confirm English and qualification details",
        detail: "Confirm the English test details, Australian study completion evidence, and any skills/licensing documents relevant to the selected 485 stream.",
        status: "required"
      },
      {
        key: "485.character_health",
        category: "character_declaration",
        title: "Confirm AFP / health / compliance details",
        detail: "Confirm police clearances, health declarations, visa compliance, refusals, cancellations, and any material history requiring agent review.",
        status: "required"
      },
      {
        key: "485.insurance",
        category: "insurance",
        title: "Confirm post-study health insurance coverage",
        detail: "Confirm the insurer, policy dates, and whether the policy covers the intended stay period after study completion.",
        status: "recommended"
      }
    );
  }

  if (context.visaSubclass === "309/100") {
    items.push(
      {
        key: "309100.identity",
        category: "relationship_family",
        title: "Confirm applicant and sponsor identity details",
        detail: "Confirm the applicant's and sponsor's current identity details, status documents, and any name changes used in the relationship evidence.",
        status: "required"
      },
      {
        key: "309100.relationship_evidence",
        category: "relationship_family",
        title: "Confirm relationship evidence categories",
        detail: "Confirm which documents best prove finances, household, social recognition, commitment, and periods spent together or apart.",
        status: "required"
      },
      {
        key: "309100.timeline",
        category: "relationship_family",
        title: "Confirm relationship timeline and witness support",
        detail: "Confirm the relationship chronology, engagement/marriage milestones, and any witness statements or Form 888 support the matter should rely on.",
        status: "required"
      },
      {
        key: "309100.character_health",
        category: "character_declaration",
        title: "Confirm health and character matters for the partner application",
        detail: "Confirm health disclosures, police clearances, refusals, cancellations, overstays, and any material issues for applicant or sponsor that need agent review.",
        status: "required"
      }
    );
  }

  if (context.visaSubclass === "482") {
    items.push(
      {
        key: "482.sponsor_nomination",
        category: "sponsor_nomination",
        title: "Confirm sponsor and nomination details",
        detail: "Confirm the sponsor business identity, nomination details, occupation, work location, salary, and any labour market testing evidence the migration agent should rely on.",
        status: "required"
      },
      {
        key: "482.employment",
        category: "employment",
        title: "Confirm employment contract and work history",
        detail: "Confirm contract details, job title, duties, references, and employment history used to support the Subclass 482 application.",
        status: "required"
      }
    );
  }

  if (context.visaSubclass === "186") {
    items.push(
      {
        key: "186.nomination",
        category: "sponsor_nomination",
        title: "Confirm employer and nomination details",
        detail: "Confirm employer identity, nomination stream, salary, position details, and how long the applicant has worked with the employer.",
        status: "required"
      },
      {
        key: "186.skills_english",
        category: "employment",
        title: "Confirm skills, English, and work history evidence",
        detail: "Confirm skills assessment, employment history, qualifications, English evidence, and any age-exemption evidence relevant to the ENS application.",
        status: "required"
      }
    );
  }

  if (context.visaSubclass === "820/801") {
    items.push(
      {
        key: "820801.relationship_categories",
        category: "relationship_family",
        title: "Confirm relationship evidence categories",
        detail: "Confirm which evidence best supports finances, household, social recognition, commitment, cohabitation, and any periods of separation for the onshore partner application.",
        status: "required"
      },
      {
        key: "820801.sponsor_status",
        category: "relationship_family",
        title: "Confirm sponsor identity and status details",
        detail: "Confirm the sponsor's citizenship or permanent residence evidence, identity details, and any previous sponsorship or relationship disclosures.",
        status: "required"
      }
    );
  }

  if (["189", "190", "491"].includes(context.visaSubclass)) {
    items.push(
      {
        key: `${context.visaSubclass}.points_claims`,
        category: "skilled_points",
        title: "Confirm skilled points claims",
        detail: "Confirm age, English, work experience, study, partner, nomination, regional, and other claimed points with the documents the migration agent should rely on.",
        status: "required"
      },
      {
        key: `${context.visaSubclass}.employment_support`,
        category: "employment",
        title: "Confirm employment history and evidence",
        detail: "Confirm roles, dates, duties, and which payslips, tax, super, and reference documents support the skilled migration claims.",
        status: "required"
      }
    );

    if (context.visaSubclass === "190" || context.visaSubclass === "491") {
      items.push({
        key: `${context.visaSubclass}.nomination`,
        category: "sponsor_nomination",
        title: "Confirm nomination or sponsorship details",
        detail: "Confirm the state nomination, regional sponsorship, or related invitation details that the migration agent should rely on.",
        status: "required"
      });
    }
  }

  if (context.visaSubclass === "600") {
    items.push(
      {
        key: "600.travel",
        category: "visitor_travel_home_ties",
        title: "Confirm purpose of visit and itinerary",
        detail: "Confirm the intended purpose of visit, travel dates, itinerary, accommodation, and any invitation details. Aria must not infer temporary stay claims without client confirmation.",
        status: "required"
      },
      {
        key: "600.home_ties",
        category: "visitor_travel_home_ties",
        title: "Confirm home ties and return incentives",
        detail: "Confirm employment, family, study, property, business, and any other ties supporting temporary stay intentions.",
        status: "required"
      },
      {
        key: "600.financial_support",
        category: "financial_capacity",
        title: "Confirm funding and support arrangements",
        detail: "Confirm available funds, source of funds, sponsor support, and the documents the migration agent should rely on for the visitor application.",
        status: "required"
      }
    );
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
