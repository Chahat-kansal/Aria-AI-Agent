import { DraftFieldStatus, GeneratedDocumentType, IssueSeverity, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptString } from "@/lib/security/encryption";
import { generateAriaAiResponse } from "@/lib/services/ai-provider";
import { isAiConfigured } from "@/lib/services/ai-config";

type DraftContext = Awaited<ReturnType<typeof getSubclass500DraftContext>>;

function readSensitive(value: string | null | undefined) {
  return value ? decryptString(value) : value ?? null;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });
}

function fieldValue(context: DraftContext, key: string) {
  const field = context.fieldsByKey.get(key);
  return field?.manualOverride || field?.value || null;
}

function fieldStatus(context: DraftContext, key: string) {
  return context.fieldsByKey.get(key)?.status ?? DraftFieldStatus.MISSING;
}

function fieldConfidence(context: DraftContext, key: string) {
  return context.fieldsByKey.get(key)?.confidence ?? null;
}

function sourceSummary(context: DraftContext, key: string) {
  const field = context.fieldsByKey.get(key);
  const evidence = field?.evidenceLinks?.[0];
  if (!evidence) return "No source-linked evidence yet.";
  const sourceName = evidence.document?.fileName || "Uploaded document";
  const snippet = evidence.sourceSnippet || field?.sourceSnippet || "";
  return `${sourceName}${snippet ? ` - ${snippet}` : ""}`;
}

async function getSubclass500DraftContext(matterId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: {
      client: true,
      documents: { orderBy: { createdAt: "desc" } },
      validationIssues: { where: { resolutionStatus: { not: "RESOLVED" } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
      applicationDrafts: {
        include: {
          fields: {
            include: {
              templateField: true,
              evidenceLinks: { include: { document: true } }
            },
            orderBy: { templateField: { sortOrder: "asc" } }
          }
        },
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  const draft = matter.applicationDrafts[0] ?? null;
  const hydratedFields = (draft?.fields ?? []).map((field) => ({
    ...field,
    value: readSensitive(field.value),
    manualOverride: readSensitive(field.manualOverride),
    sourceSnippet: readSensitive(field.sourceSnippet),
    sourcePageRef: readSensitive(field.sourcePageRef),
    notes: readSensitive(field.notes),
    evidenceLinks: field.evidenceLinks.map((link) => ({
      ...link,
      sourceSnippet: readSensitive(link.sourceSnippet),
      sourcePageRef: readSensitive(link.sourcePageRef)
    }))
  }));

  return {
    matter,
    draft,
    fields: hydratedFields,
    fieldsByKey: new Map(hydratedFields.map((field) => [field.templateField.fieldKey, field]))
  };
}

function reviewStatusLabel(status: DraftFieldStatus) {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatIssueSeverity(severity: IssueSeverity) {
  return severity.toLowerCase();
}

const attentionStatuses: DraftFieldStatus[] = [
  DraftFieldStatus.MISSING,
  DraftFieldStatus.NEEDS_REVIEW,
  DraftFieldStatus.CONFLICTING
];

function buildCoverLetter(context: DraftContext) {
  const fullName = fieldValue(context, "applicant.full_name") || `${context.matter.client.firstName} ${context.matter.client.lastName}`.trim();
  const dob = formatDate(fieldValue(context, "applicant.date_of_birth"));
  const nationality = fieldValue(context, "applicant.nationality");
  const passport = fieldValue(context, "applicant.passport_number");
  const provider = fieldValue(context, "study.provider");
  const course = fieldValue(context, "study.course_name");
  const coeNumber = fieldValue(context, "study.coe_number");
  const courseStart = formatDate(fieldValue(context, "study.course_start_date"));
  const funds = fieldValue(context, "financial.available_funds");
  const oshc = fieldValue(context, "health.oshc_provider");
  const hasStatement = fieldValue(context, "statement.genuine_student");

  const missing = [
    !passport ? "Passport number" : null,
    !provider ? "Education provider" : null,
    !course ? "Course name" : null,
    !coeNumber ? "CoE number" : null,
    !funds ? "Financial capacity evidence" : null,
    !oshc ? "OSHC provider" : null
  ].filter(Boolean);

  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.",
    "",
    `Re: Student visa (Subclass 500) matter draft for ${fullName}`,
    "",
    "Matter summary",
    `- Matter: ${context.matter.title}`,
    `- Client: ${fullName}`,
    `- Date of birth: ${dob || "[MISSING: date of birth]"}`,
    `- Nationality: ${nationality || "[MISSING: nationality]"}`,
    `- Passport number: ${passport || "[MISSING: passport number]"}`,
    `- Course provider: ${provider || "[MISSING: education provider]"}`,
    `- Course name: ${course || "[MISSING: course name]"}`,
    `- CoE number: ${coeNumber || "[MISSING: CoE number]"}`,
    `- Course start date: ${courseStart || "[MISSING: course start date]"}`,
    "",
    "Evidence-led observations",
    `- Financial capacity evidence: ${funds || "[MISSING: financial capacity evidence]"} (${reviewStatusLabel(fieldStatus(context, "financial.available_funds"))})`,
    `- OSHC / health insurance: ${oshc || "[MISSING: OSHC evidence]"} (${reviewStatusLabel(fieldStatus(context, "health.oshc_provider"))})`,
    `- Genuine student statement evidence: ${hasStatement ? "Uploaded" : "[MISSING: genuine student statement]"}`,
    "",
    "Source-linked checkpoints",
    `- Passport evidence: ${sourceSummary(context, "applicant.passport_number")}`,
    `- CoE evidence: ${sourceSummary(context, "study.coe_number")}`,
    `- Financial evidence: ${sourceSummary(context, "financial.available_funds")}`,
    `- OSHC evidence: ${sourceSummary(context, "health.oshc_provider")}`,
    "",
    "Agent review focus",
    "- Confirm every personal identifier directly against the passport biodata page before client-facing use.",
    "- Confirm the CoE details, course dates, and provider information against the uploaded enrolment evidence.",
    "- Confirm that financial evidence is current, sufficient, and appropriate for the intended application strategy.",
    "- Confirm OSHC coverage dates and insurer before any submission-preparation steps.",
    "- Review the genuine student statement and any inconsistencies across uploaded documents before client review.",
    "",
    missing.length
      ? `Outstanding information requiring agent follow-up: ${missing.join("; ")}.`
      : "No critical information gaps were detected from the currently mapped draft fields, but full registered migration agent review is still required."
  ].join("\n");
}

function buildDocumentRequestChecklist(context: DraftContext) {
  const missingChecklist = context.matter.checklistItems.filter((item) => !item.documentId);
  const missingFields = context.fields
    .filter((field) => attentionStatuses.includes(field.status))
    .map((field) => `${field.templateField.label} (${reviewStatusLabel(field.status)})`);

  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "This checklist is a working draft for migration agent follow-up. It is not final migration advice and does not lodge applications.",
    "",
    `Document request checklist for ${context.matter.client.firstName} ${context.matter.client.lastName}`,
    "",
    "Outstanding checklist items",
    ...(missingChecklist.length
      ? missingChecklist.map((item, index) => `${index + 1}. ${item.label} - ${item.description}`)
      : ["1. No checklist items are currently marked missing. Confirm completeness manually before closing the evidence stage."]),
    "",
    "Draft field issues to resolve",
    ...(missingFields.length
      ? missingFields.map((item, index) => `${index + 1}. ${item}`)
      : ["1. No draft field gaps were detected from the current mapped set."]),
    "",
    "Agent follow-up prompts",
    "- Ask the client to upload clear, complete PDF copies where possible.",
    "- Ask the client to explain any date, identity, or course inconsistencies before draft approval.",
    "- Do not mark any unsupported field as verified until the source evidence is reviewed."
  ].join("\n");
}

function buildGenuineStudentOutline(context: DraftContext) {
  const provider = fieldValue(context, "study.provider");
  const course = fieldValue(context, "study.course_name");
  const courseStart = formatDate(fieldValue(context, "study.course_start_date"));
  const funds = fieldValue(context, "financial.available_funds");

  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "This outline is a preparation aid only. Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.",
    "",
    "Genuine student statement outline",
    "",
    "1. Course and provider",
    `- Intended provider: ${provider || "[MISSING: education provider]"}`,
    `- Intended course: ${course || "[MISSING: course name]"}`,
    `- Intended commencement: ${courseStart || "[MISSING: course start date]"}`,
    "",
    "2. Study rationale",
    "- Explain why this course is appropriate for the applicant's background and career direction.",
    "- Explain why this provider and study location were chosen.",
    "",
    "3. Financial capacity",
    `- Current evidence reference: ${funds || "[MISSING: financial evidence summary]"}`,
    "- Confirm tuition, living, and travel cost support from uploaded evidence.",
    "",
    "4. Temporary entrant / future plans",
    "- Explain the applicant's genuine reasons for study in Australia.",
    "- Explain the applicant's circumstances in their home country and future plans after study.",
    "",
    "5. Agent review notes",
    "- Do not let Aria invent motivations, family circumstances, or future intentions.",
    "- Replace every placeholder with client-confirmed facts before sending to the client.",
    "- Review all statements against uploaded evidence and interview notes."
  ].join("\n");
}

function buildStatutoryDeclarationTemplate(context: DraftContext) {
  const fullName = fieldValue(context, "applicant.full_name") || `${context.matter.client.firstName} ${context.matter.client.lastName}`.trim();
  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Template only. Replace placeholders with verified client facts before use.",
    "",
    "Statutory declaration template",
    "",
    `I, ${fullName}, of [address], do solemnly and sincerely declare that:`,
    "- [INSERT VERIFIED FACTUAL STATEMENT 1]",
    "- [INSERT VERIFIED FACTUAL STATEMENT 2]",
    "- [INSERT VERIFIED FACTUAL STATEMENT 3]",
    "",
    "Review notes",
    "- Do not include unverified declarations.",
    "- Do not complete signature, witness, or execution blocks automatically.",
    "- This system does not lodge applications."
  ].join("\n");
}

function buildCharacterReferenceTemplate(context: DraftContext) {
  const fullName = fieldValue(context, "applicant.full_name") || `${context.matter.client.firstName} ${context.matter.client.lastName}`.trim();
  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Template only. Referee identity, relationship, and factual statements must be verified by the migration agent.",
    "",
    "Character reference template",
    "",
    `Re: Character reference for ${fullName}`,
    "",
    "I, [REFEREE NAME], have known the applicant since [DATE/CONTEXT].",
    "- Relationship to applicant: [INSERT VERIFIED RELATIONSHIP]",
    "- Capacity in which the referee knows the applicant: [INSERT VERIFIED CONTEXT]",
    "- Observations relevant to character: [INSERT VERIFIED FACTS ONLY]",
    "",
    "Review notes",
    "- Do not invent relationship history or character claims.",
    "- Replace placeholders only with referee-confirmed statements."
  ].join("\n");
}

function buildSkillsAssessmentChecklist(context: DraftContext) {
  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Working checklist only. Review the current visa strategy before relying on this list.",
    "",
    `Skills assessment review checklist for ${context.matter.client.firstName} ${context.matter.client.lastName}`,
    "",
    "- Confirm whether a skills assessment is required for the current pathway.",
    "- Confirm current occupation, ANZSCO alignment, and assessing authority.",
    "- Confirm employment evidence chronology from uploaded resume and reference letters.",
    "- Confirm education evidence and transcripts where relevant.",
    "- Confirm passport identity evidence and any name variations.",
    "",
    "Current matter caveat",
    "- This checklist may not apply to every Subclass 500 matter. Migration agent review is required before requesting skills assessment evidence."
  ].join("\n");
}

function buildSponsorshipChecklist(context: DraftContext) {
  return [
    "AI-assisted output. Registered migration agent review required before use.",
    "Working checklist only. This is not a final sponsorship advice document.",
    "",
    `Sponsorship checklist for ${context.matter.client.firstName} ${context.matter.client.lastName}`,
    "",
    "- Confirm whether employer sponsorship is relevant to the selected migration strategy.",
    "- Confirm sponsor identity, nomination pathway, and supporting business evidence if applicable.",
    "- Confirm applicant identity, qualifications, and employment history against uploaded evidence.",
    "",
    "Current matter caveat",
    "- This checklist is only relevant if sponsorship becomes part of the case strategy. Migration agent review required."
  ].join("\n");
}

async function maybeEnhanceWithAi(baseContent: string, context: DraftContext, type: GeneratedDocumentType) {
  if (!isAiConfigured()) return baseContent;

  const ai = await generateAriaAiResponse({
    system: `You are Aria, assisting a registered migration agent. Improve clarity and structure for a Subclass 500 migration draft without inventing facts. Keep all review-required warnings. Return JSON: {"content": string}.`,
    user: `Refine this ${type.toLowerCase()} draft while preserving only grounded facts and placeholders for missing information.`,
    context: {
      baseContent,
      matter: {
        title: context.matter.title,
        visaSubclass: context.matter.visaSubclass,
        visaStream: context.matter.visaStream,
        client: `${context.matter.client.firstName} ${context.matter.client.lastName}`.trim()
      },
      openIssues: context.matter.validationIssues.map((issue) => ({
        title: issue.title,
        severity: issue.severity,
        description: issue.description
      }))
    }
  }).catch(() => null);

  return typeof ai?.content === "string" && ai.content.trim() ? ai.content.trim() : baseContent;
}

export async function buildGeneratedDocumentForMatter(matterId: string, type: GeneratedDocumentType) {
  const context = await getSubclass500DraftContext(matterId);

  if (context.matter.visaSubclass !== "500") {
    return { supported: false as const, reason: "Deterministic draft generation is currently configured for Subclass 500 matters only." };
  }

  let title = "";
  let baseContent = "";

  switch (type) {
    case "COVER_LETTER":
      title = `Subclass 500 covering letter - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildCoverLetter(context);
      break;
    case "DOCUMENT_REQUEST_CHECKLIST":
      title = `Subclass 500 evidence checklist - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildDocumentRequestChecklist(context);
      break;
    case "GENUINE_STUDENT_STATEMENT_OUTLINE":
      title = `Genuine student statement outline - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildGenuineStudentOutline(context);
      break;
    case "STATUTORY_DECLARATION_TEMPLATE":
      title = `Statutory declaration template - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildStatutoryDeclarationTemplate(context);
      break;
    case "CHARACTER_REFERENCE_TEMPLATE":
      title = `Character reference template - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildCharacterReferenceTemplate(context);
      break;
    case "SKILLS_ASSESSMENT_CHECKLIST":
      title = `Skills assessment checklist - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildSkillsAssessmentChecklist(context);
      break;
    case "SPONSORSHIP_CHECKLIST":
      title = `Sponsorship checklist - ${context.matter.client.firstName} ${context.matter.client.lastName}`;
      baseContent = buildSponsorshipChecklist(context);
      break;
    default:
      return { supported: false as const, reason: `Generated draft type ${type} is not supported by the current TypeScript draft engine.` };
  }

  const content = await maybeEnhanceWithAi(baseContent, context, type);

  return {
    supported: true as const,
    title,
    content,
    metadata: {
      subclassCode: context.matter.visaSubclass,
      openIssues: context.matter.validationIssues.length,
      verifiedFields: context.fields.filter((field) => field.status === DraftFieldStatus.VERIFIED).length,
      needsReviewFields: context.fields.filter((field) => field.status === DraftFieldStatus.NEEDS_REVIEW).length,
      conflictingFields: context.fields.filter((field) => field.status === DraftFieldStatus.CONFLICTING).length
    }
  };
}

export async function buildMatterDraftBriefing(matterId: string) {
  const context = await getSubclass500DraftContext(matterId);
  const fullName = fieldValue(context, "applicant.full_name") || `${context.matter.client.firstName} ${context.matter.client.lastName}`.trim();
  const missingFields = context.fields.filter((field) => attentionStatuses.includes(field.status));
  const unsupportedDocs = context.matter.documents.filter((document) => document.reviewStatus !== ReviewStatus.VERIFIED);
  const criticalIssues = context.matter.validationIssues.filter((issue) => issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.HIGH);

  return {
    title: `Draft briefing for ${fullName}`,
    summary: [
      `Matter: ${context.matter.title}`,
      `Subclass: ${context.matter.visaSubclass}`,
      `Readiness score: ${context.draft?.readinessScore ?? context.matter.readinessScore}%`,
      `Open validation issues: ${context.matter.validationIssues.length}`
    ],
    missingFields: missingFields.slice(0, 8).map((field) => ({
      label: field.templateField.label,
      status: reviewStatusLabel(field.status),
      source: field.evidenceLinks[0]?.document?.fileName || null
    })),
    criticalIssues: criticalIssues.slice(0, 6).map((issue) => ({
      title: issue.title,
      severity: formatIssueSeverity(issue.severity),
      description: issue.description
    })),
    evidenceNotes: unsupportedDocs.slice(0, 6).map((document) => ({
      fileName: document.fileName,
      category: titleCase(document.category),
      reviewStatus: document.reviewStatus.toLowerCase()
    }))
  };
}
