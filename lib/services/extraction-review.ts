import { type Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeDecryptJson, decryptString } from "@/lib/security/encryption";
import { getAiConfigStatus, getEncryptionConfigStatus } from "@/lib/services/runtime-config";
import { scopedMatterWhere, hasPermission } from "@/lib/services/roles";

type ScopedUser = Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">;

export type ExtractionReliability =
  | "OFFICIAL"
  | "CLIENT_SUPPLIED"
  | "AGENT_ENTERED"
  | "AI_EXTRACTED"
  | "SYSTEM_DERIVED";

export type ExtractionFieldStatus =
  | "verified"
  | "needs_review"
  | "missing"
  | "low_confidence"
  | "conflicting"
  | "agent_edited";

export type ExtractionMaskKind = "passport" | "dob" | "grant" | "policy" | "address" | "email" | "phone";

export type ExtractionReviewField = {
  key: string;
  label: string;
  value: string | null;
  status: ExtractionFieldStatus;
  confidence: number | null;
  sourceDocumentId?: string | null;
  sourceDocumentName?: string | null;
  sourceSnippet?: string | null;
  sourcePageRef?: string | null;
  reliability: ExtractionReliability;
  downloadHref?: string | null;
  note?: string | null;
  maskKind?: ExtractionMaskKind;
};

export type ExtractionReviewSection = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tabIds: string[];
  fields: ExtractionReviewField[];
};

export type ExtractionReviewPerson = {
  id: string;
  tabId: string;
  role: string;
  name: string;
  status: string;
  flagCount: number;
  fields: ExtractionReviewField[];
};

export type ExtractionReviewDocument = {
  id: string;
  fileName: string;
  category: string;
  extractionStatus: string;
  reviewStatus: string;
  extractionConfidence: number | null;
  weakOcr: boolean;
  qualityStatus: string | null;
  qualityScore: number | null;
  qualityWarnings: string[];
  reuploadMessage: string | null;
  autofillCriticalFieldsAllowed: boolean;
  linkedDraftFields: number;
  linkedChecklistItems: number;
  downloadHref: string;
};

export type ExtractionReviewFlag = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  reason: string;
  evidence: string;
  recommendedAction: string;
  href?: string | null;
  reviewEnabled: boolean;
  reviewReason?: string | null;
};

export type ExtractionReviewSummary = {
  matterId: string;
  matterReference: string;
  applicantName: string;
  visaSubclass: string;
  visaStream: string;
  location: string | null;
  draftReadiness: number;
  activeFlags: number;
  uploadedDocuments: number;
  missingRequiredFields: number;
  lastExtractionAt: string | null;
  reviewStatus: string;
  currentTabId: string;
  hasExtractedEvidence: boolean;
  aiConfigured: boolean;
  encryptionConfigured: boolean;
  reviewHref: string;
  draftHref: string;
  documentsHref: string;
  formsHref: string;
  generatedDocumentsHref: string;
  exportHref: string;
  portalHref: string;
  canRunAiDraftAutofill: boolean;
  canRunCrossCheck: boolean;
};

export type ExtractionReviewDashboardData = {
  summary: ExtractionReviewSummary;
  tabs: Array<{ id: string; label: string; role: string; status: string; flagCount: number }>;
  sections: ExtractionReviewSection[];
  people: ExtractionReviewPerson[];
  documents: ExtractionReviewDocument[];
  flags: ExtractionReviewFlag[];
  nextActions: string[];
  draftStats: {
    mapped: number;
    verified: number;
    needsReview: number;
    conflicting: number;
    missing: number;
  };
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function statusFromDraft(status?: string | null, confidence?: number | null): ExtractionFieldStatus {
  if (!status && !confidence) return "missing";
  if (status === "VERIFIED") return "verified";
  if (status === "CONFLICTING") return "conflicting";
  if (status === "HIGH_CONFIDENCE") return "verified";
  if (status === "SUPPORTED") return "needs_review";
  if (status === "NEEDS_REVIEW") return "needs_review";
  if (status === "MISSING") return "missing";
  if ((confidence ?? 0) < 0.75) return "low_confidence";
  return "needs_review";
}

function reliabilityFromSource(source: "client" | "agent" | "ai" | "system"): ExtractionReliability {
  switch (source) {
    case "client":
      return "CLIENT_SUPPLIED";
    case "agent":
      return "AGENT_ENTERED";
    case "ai":
      return "AI_EXTRACTED";
    default:
      return "SYSTEM_DERIVED";
  }
}

function safeString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function maybeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function getNestedValue(record: unknown, path: string): unknown {
  if (!record || typeof record !== "object") return null;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function flattenExtractionFields(document: any) {
  const extraction = maybeDecryptJson<Record<string, any>>(document.extractionResults[0]?.extractedJson ?? {});
  const fieldsFromPayload = maybeArray(extraction.fields).map((field) => ({
    key: safeString(field?.key),
    value: safeString(field?.value),
    confidence: typeof field?.confidence === "number" ? field.confidence : null,
    snippet: safeString(field?.snippet),
    pageRef: null,
    sourceDocumentId: document.id,
    sourceDocumentName: document.fileName
  })).filter((field) => field.key);

  const fieldsFromRecords = document.extractedFields.map((field: any) => ({
    key: field.fieldKey,
    value: field.fieldValue ? decryptString(field.fieldValue) : null,
    confidence: typeof field.confidence === "number" ? field.confidence : null,
    snippet: field.sourceSnippet ? decryptString(field.sourceSnippet) : null,
    pageRef: field.sourcePageRef ? decryptString(field.sourcePageRef) : null,
    sourceDocumentId: document.id,
    sourceDocumentName: document.fileName
  }));

  return { extraction, fields: [...fieldsFromPayload, ...fieldsFromRecords] };
}

function buildFieldFromCandidate(input: {
  key: string;
  label: string;
  candidate?: any;
  fallbackValue?: string | null;
  fallbackSource?: "client" | "agent" | "ai" | "system";
  fallbackNote?: string | null;
  maskKind?: ExtractionMaskKind;
  draftStatus?: string | null;
}) : ExtractionReviewField {
  const value = safeString(input.candidate?.value) ?? safeString(input.fallbackValue) ?? null;
  const confidence = typeof input.candidate?.confidence === "number"
    ? input.candidate.confidence
    : value && input.fallbackValue
      ? 1
      : null;
  const sourceDocumentId = input.candidate?.sourceDocumentId ?? null;
  const sourceDocumentName = input.candidate?.sourceDocumentName ?? (input.fallbackValue ? "Stored matter record" : null);
  const sourceSnippet = safeString(input.candidate?.snippet);
  const sourcePageRef = safeString(input.candidate?.pageRef);
  const reliability = input.candidate
    ? "AI_EXTRACTED"
    : reliabilityFromSource(input.fallbackSource ?? "system");

  return {
    key: input.key,
    label: input.label,
    value,
    status: value ? statusFromDraft(input.draftStatus, confidence) : "missing",
    confidence,
    sourceDocumentId,
    sourceDocumentName,
    sourceSnippet,
    sourcePageRef,
    reliability,
    downloadHref: sourceDocumentId ? `/api/documents/${sourceDocumentId}/download` : null,
    note: value ? input.fallbackNote ?? null : "Source required",
    maskKind: input.maskKind
  };
}

function sectionMeta(sectionKey: string) {
  if (/employment/i.test(sectionKey)) return { icon: "BriefcaseBusiness", description: "Employment, occupation, and sponsor-linked work evidence." };
  if (/skills|points/i.test(sectionKey)) return { icon: "BadgeCheck", description: "Skills assessments, points claims, and qualification-backed migration evidence." };
  if (/relationship|witness/i.test(sectionKey)) return { icon: "HeartHandshake", description: "Relationship chronology, witness support, and partner evidence categories." };
  if (/travel|visitor|home_ties/i.test(sectionKey)) return { icon: "PlaneTakeoff", description: "Travel plans, visitor purpose, itinerary, and home ties evidence." };
  if (/sponsor|nomination/i.test(sectionKey)) return { icon: "Building2", description: "Sponsor, employer, nomination, and business evidence." };
  if (/financial/i.test(sectionKey)) return { icon: "WalletCards", description: "Funds, support, and financial capacity evidence." };
  return { icon: "Files", description: "Subclass-specific extracted evidence and mapped draft fields." };
}

export async function getMatterExtractionReviewData(workspaceId: string, matterId: string, user: ScopedUser): Promise<ExtractionReviewDashboardData | null> {
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, ...(scopedMatterWhere(user) as Prisma.MatterWhereInput) },
    include: {
      client: true,
      assignedToUser: true,
      validationIssues: { orderBy: { createdAt: "desc" } },
      checklistItems: { include: { document: true }, orderBy: { label: "asc" } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          extractionResults: { orderBy: { createdAt: "desc" }, take: 1 },
          extractedFields: { orderBy: { createdAt: "desc" } },
          draftEvidenceLinks: {
            include: {
              draftField: { include: { templateField: true } }
            },
            orderBy: { createdAt: "desc" }
          },
          checklistItems: true
        }
      },
      applicationDrafts: {
        orderBy: { updatedAt: "desc" },
        include: {
          template: { include: { sections: { include: { fields: true }, orderBy: { sortOrder: "asc" } } } },
          fields: {
            include: {
              templateField: true,
              evidenceLinks: { include: { document: true }, orderBy: { createdAt: "desc" } }
            },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      appointments: { orderBy: { startsAt: "asc" } },
      intakeRequests: { orderBy: { createdAt: "desc" } },
      documentRequests: { orderBy: { createdAt: "desc" } },
      impacts: { include: { officialUpdate: true }, orderBy: { createdAt: "desc" } }
    }
  });

  if (!matter) return null;

  const draft = matter.applicationDrafts[0] ?? null;
  const draftFieldIndex = new Map<string, any>();
  for (const field of draft?.fields ?? []) {
    draftFieldIndex.set(field.templateField.fieldKey, field);
  }

  const documentFacts = matter.documents.map((document) => {
    const flattened = flattenExtractionFields(document);
    const extraction = flattened.extraction;
    const extractionConfidence = typeof extraction.extractionConfidence === "number" ? extraction.extractionConfidence : null;
    const quality = extraction.documentQuality && typeof extraction.documentQuality === "object" ? extraction.documentQuality : null;
    return {
      ...document,
      extraction,
      extractionConfidence,
      weakOcr: !safeString(extraction.extractedTextPreview) || String(extraction.extractedTextPreview).length < 100,
      qualityStatus: safeString(quality?.status),
      qualityScore: typeof quality?.score === "number" ? quality.score : null,
      qualityWarnings: maybeArray(quality?.warnings).map(String),
      reuploadMessage: safeString(quality?.reuploadMessage),
      autofillCriticalFieldsAllowed: quality?.autofillCriticalFieldsAllowed !== false,
      flattenedFields: flattened.fields
    };
  });

  const extractionFieldIndex = new Map<string, any[]>();
  for (const document of documentFacts) {
    for (const field of document.flattenedFields) {
      if (!field.key) continue;
      const current = extractionFieldIndex.get(field.key) ?? [];
      current.push(field);
      extractionFieldIndex.set(field.key, current);
    }
  }

  const candidateFor = (...keys: string[]) => {
    for (const key of keys) {
      const candidates = extractionFieldIndex.get(key);
      if (candidates?.length) return candidates[0];
    }
    return null;
  };

  const extractionPayloads = documentFacts.map((document) => document.extraction);
  const firstPayloadValue = (...paths: string[]) => {
    for (const payload of extractionPayloads) {
      for (const path of paths) {
        const value = getNestedValue(payload, path);
        const text = safeString(value);
        if (text) return text;
      }
    }
    return null;
  };

  const familyCandidates = uniqueStrings(extractionPayloads.flatMap((payload) => {
    const family = [
      ...maybeArray(payload.familyMembers),
      ...maybeArray(payload.dependants),
      ...maybeArray(payload.children),
      ...maybeArray(payload.accompanyingFamily),
      ...(payload.partner ? [payload.partner] : [])
    ];
    return family.map((person: any) => safeString(person?.full_name || person?.name || `${person?.given_name ?? ""} ${person?.family_name ?? ""}`));
  }));

  const relatedPeople: ExtractionReviewPerson[] = familyCandidates.map((name, index) => ({
    id: `related-${index + 1}`,
    tabId: `related-${index + 1}`,
    role: index === 0 ? "Spouse / partner" : "Dependant",
    name,
    status: "Needs review",
    flagCount: 0,
    fields: [{
      key: `related.${index}.name`,
      label: "Name",
      value: name,
      status: "needs_review",
      confidence: null,
      reliability: "AI_EXTRACTED",
      sourceDocumentName: "Uploaded evidence",
      sourceSnippet: "Extracted related person name from uploaded evidence.",
      downloadHref: null
    }]
  }));

  const primaryApplicantTab = matter.client.id;
  const tabs = [
    { id: "application", label: "Application", role: `${matter.visaSubclass} / ${matter.visaStream}`, status: "Review required", flagCount: 0 },
    { id: primaryApplicantTab, label: `${matter.client.firstName} ${matter.client.lastName}`, role: "Primary applicant", status: "Needs review", flagCount: 0 },
    ...relatedPeople.map((person) => ({ id: person.tabId, label: person.name, role: person.role, status: person.status, flagCount: person.flagCount }))
  ];

  const applicationContextFields: ExtractionReviewField[] = [
    buildFieldFromCandidate({
      key: "application.current_location",
      label: "Current location",
      fallbackValue: firstPayloadValue("current_location", "location"),
      fallbackSource: "agent"
    }),
    buildFieldFromCandidate({
      key: "application.type",
      label: "Application type",
      fallbackValue: matter.title,
      fallbackSource: "agent"
    }),
    buildFieldFromCandidate({
      key: "application.subclass",
      label: "Visa subclass",
      fallbackValue: matter.visaSubclass,
      fallbackSource: "agent"
    }),
    buildFieldFromCandidate({
      key: "application.stream",
      label: "Visa stream",
      fallbackValue: matter.visaStream,
      fallbackSource: "agent"
    }),
    buildFieldFromCandidate({
      key: "application.reference",
      label: "Matter reference",
      fallbackValue: matter.matterReference ?? matter.id.slice(0, 8),
      fallbackSource: "system"
    })
  ];

  const primaryApplicantFields: ExtractionReviewField[] = [
    buildFieldFromCandidate({
      key: "applicant.full_name",
      label: "Full name",
      candidate: candidateFor("applicant.full_name", "given_name"),
      fallbackValue: `${matter.client.firstName} ${matter.client.lastName}`,
      fallbackSource: "client",
      draftStatus: draftFieldIndex.get("applicant.full_name")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.date_of_birth",
      label: "Date of birth",
      candidate: candidateFor("applicant.date_of_birth", "date_of_birth"),
      fallbackValue: formatDateOnly(matter.client.dob),
      fallbackSource: "client",
      maskKind: "dob",
      draftStatus: draftFieldIndex.get("applicant.date_of_birth")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.nationality",
      label: "Nationality",
      candidate: candidateFor("applicant.nationality", "nationality"),
      fallbackValue: matter.client.nationality,
      fallbackSource: "client",
      draftStatus: draftFieldIndex.get("applicant.nationality")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.passport_number",
      label: "Passport number",
      candidate: candidateFor("applicant.passport_number", "passport_number"),
      maskKind: "passport",
      draftStatus: draftFieldIndex.get("applicant.passport_number")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.passport_expiry",
      label: "Passport expiry",
      candidate: candidateFor("applicant.passport_expiry", "expiry_date"),
      draftStatus: draftFieldIndex.get("applicant.passport_expiry")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.country_of_birth",
      label: "Country of birth",
      candidate: candidateFor("applicant.country_of_birth", "country_of_birth"),
      draftStatus: draftFieldIndex.get("applicant.country_of_birth")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.place_of_birth",
      label: "Place of birth",
      candidate: candidateFor("applicant.place_of_birth", "place_of_birth"),
      draftStatus: draftFieldIndex.get("applicant.place_of_birth")?.status
    }),
    buildFieldFromCandidate({
      key: "applicant.relationship_status",
      label: "Relationship status",
      candidate: candidateFor("applicant.relationship_status", "relationship_status")
    })
  ];

  const contactFields: ExtractionReviewField[] = [
    buildFieldFromCandidate({
      key: "contact.email",
      label: "Email",
      fallbackValue: matter.client.email,
      fallbackSource: "client",
      maskKind: "email"
    }),
    buildFieldFromCandidate({
      key: "contact.phone",
      label: "Phone",
      fallbackValue: matter.client.phone,
      fallbackSource: "client",
      maskKind: "phone"
    }),
    buildFieldFromCandidate({
      key: "contact.address",
      label: "Address",
      candidate: candidateFor("contact.address", "residential_address"),
      fallbackValue: firstPayloadValue("address", "residential_address", "postal_address"),
      fallbackSource: "client",
      maskKind: "address"
    })
  ];

  const studyFields = [
    buildFieldFromCandidate({
      key: "study.coe_number",
      label: "CoE number",
      candidate: candidateFor("study.coe_number", "coe_number"),
      draftStatus: draftFieldIndex.get("study.coe_number")?.status
    }),
    buildFieldFromCandidate({
      key: "study.provider",
      label: "Education provider",
      candidate: candidateFor("study.provider", "provider_name"),
      draftStatus: draftFieldIndex.get("study.provider")?.status
    }),
    buildFieldFromCandidate({
      key: "study.course_name",
      label: "Course",
      candidate: candidateFor("study.course_name", "course_name"),
      draftStatus: draftFieldIndex.get("study.course_name")?.status
    }),
    buildFieldFromCandidate({
      key: "study.cricos",
      label: "CRICOS",
      candidate: candidateFor("study.cricos", "cricos_code")
    }),
    buildFieldFromCandidate({
      key: "study.course_start_date",
      label: "Course start",
      candidate: candidateFor("study.course_start_date", "start_date"),
      draftStatus: draftFieldIndex.get("study.course_start_date")?.status
    }),
    buildFieldFromCandidate({
      key: "study.course_end_date",
      label: "Course end",
      candidate: candidateFor("study.course_end_date", "end_date")
    })
  ];

  const englishFields = [
    buildFieldFromCandidate({
      key: "english.test_type",
      label: "Test type",
      fallbackValue: firstPayloadValue("document_type", "test_type"),
      fallbackSource: "ai"
    }),
    buildFieldFromCandidate({
      key: "english.test_date",
      label: "Test date",
      candidate: candidateFor("english.test_date", "test_date")
    }),
    buildFieldFromCandidate({
      key: "english.reference_number",
      label: "Reference number",
      candidate: candidateFor("english.reference_number", "registration_number", "score_report_number", "report_number")
    }),
    buildFieldFromCandidate({
      key: "english.overall_score",
      label: "Overall score",
      candidate: candidateFor("english.overall_score", "overall_score")
    }),
    buildFieldFromCandidate({
      key: "english.validity",
      label: "Validity / expiry",
      candidate: candidateFor("english.validity", "validity_date", "expiry_date")
    })
  ];

  const insuranceFields = [
    buildFieldFromCandidate({
      key: "health.oshc_provider",
      label: "OSHC / OVHC provider",
      candidate: candidateFor("health.oshc_provider", "oshc_provider")
    }),
    buildFieldFromCandidate({
      key: "health.policy_number",
      label: "Policy number",
      candidate: candidateFor("health.policy_number", "policy_number"),
      maskKind: "policy"
    }),
    buildFieldFromCandidate({
      key: "health.cover_start",
      label: "Cover start",
      candidate: candidateFor("health.cover_start", "oshc_start")
    }),
    buildFieldFromCandidate({
      key: "health.cover_end",
      label: "Cover end",
      candidate: candidateFor("health.cover_end", "oshc_end")
    })
  ];

  const fundingFields = [
    buildFieldFromCandidate({
      key: "financial.available_funds",
      label: "Declared funds",
      candidate: candidateFor("financial.available_funds", "available_funds")
    }),
    buildFieldFromCandidate({
      key: "financial.funding_source",
      label: "Funding source",
      candidate: candidateFor("financial.funding_source", "funding_source")
    }),
    buildFieldFromCandidate({
      key: "financial.sponsor_relationship",
      label: "Sponsor relationship",
      candidate: candidateFor("financial.sponsor_relationship", "sponsor_relationship")
    })
  ];

  const visaHistoryFields = [
    buildFieldFromCandidate({
      key: "visa.current_visa",
      label: "Current visa",
      fallbackValue: matter.currentVisaStatus,
      fallbackSource: "agent"
    }),
    buildFieldFromCandidate({
      key: "visa.grant_number",
      label: "Grant number",
      candidate: candidateFor("visa.grant_number", "grant_number"),
      maskKind: "grant"
    }),
    buildFieldFromCandidate({
      key: "visa.refusals",
      label: "Refusals / cancellations",
      candidate: candidateFor("visa.refusals", "refusals", "cancellations")
    }),
    buildFieldFromCandidate({
      key: "visa.compliance_history",
      label: "Compliance history",
      candidate: candidateFor("visa.compliance_history", "compliance_history")
    })
  ];

  const declarationFields = [
    buildFieldFromCandidate({
      key: "declarations.health",
      label: "Health declarations",
      candidate: candidateFor("declarations.health", "health_answers")
    }),
    buildFieldFromCandidate({
      key: "declarations.character",
      label: "Character declarations",
      candidate: candidateFor("declarations.character", "character_answers", "criminal_history")
    }),
    buildFieldFromCandidate({
      key: "declarations.relationship",
      label: "Relationship history",
      candidate: candidateFor("declarations.relationship", "relationship_history")
    })
  ];

  const sections: ExtractionReviewSection[] = [
    {
      id: "application-context",
      title: "Application context",
      description: "Matter-level application setup, references, and current context.",
      icon: "FolderKanban",
      tabIds: ["application"],
      fields: applicationContextFields.filter((field) => field.value || field.note === "Source required")
    },
    {
      id: "primary-applicant",
      title: "Primary applicant",
      description: "Identity details and extraction-backed core applicant fields.",
      icon: "UserRound",
      tabIds: [primaryApplicantTab],
      fields: primaryApplicantFields
    },
    {
      id: "contact",
      title: "Contact and address",
      description: "Client profile contact details and extracted address evidence where available.",
      icon: "MapPinned",
      tabIds: [primaryApplicantTab],
      fields: contactFields
    },
    {
      id: "study",
      title: "CoE / study",
      description: "Education provider, course, CRICOS, and enrolment evidence.",
      icon: "GraduationCap",
      tabIds: ["application", primaryApplicantTab],
      fields: studyFields
    },
    {
      id: "english",
      title: "English language",
      description: "English evidence, scores, expiry, and likely threshold warnings.",
      icon: "Languages",
      tabIds: ["application", primaryApplicantTab],
      fields: englishFields
    },
    {
      id: "insurance",
      title: "Health insurance",
      description: "OSHC / OVHC coverage and insurer evidence.",
      icon: "ShieldCheck",
      tabIds: ["application", primaryApplicantTab],
      fields: insuranceFields
    },
    {
      id: "funding",
      title: "Funding / financial capacity",
      description: "Declared funds, sponsor relationship, and source-backed finance evidence.",
      icon: "WalletCards",
      tabIds: ["application", primaryApplicantTab],
      fields: fundingFields
    },
    {
      id: "visa-history",
      title: "Visa history",
      description: "Current visa, grant details, refusals, and compliance history when extracted.",
      icon: "History",
      tabIds: ["application", primaryApplicantTab],
      fields: visaHistoryFields
    },
    {
      id: "declarations",
      title: "Health / character / declarations",
      description: "Only shown where evidence exists. These answers remain review required.",
      icon: "FileWarning",
      tabIds: [primaryApplicantTab],
      fields: declarationFields.filter((field) => field.value)
    }
  ].filter((section) => section.fields.length);

  const coveredFieldKeys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const templateCatchAllSections = draft?.template.sections
    .map((section: any) => {
      const extraFields = section.fields
        .filter((templateField: any) => !coveredFieldKeys.has(templateField.fieldKey))
        .map((templateField: any) => {
          const candidate = candidateFor(templateField.fieldKey);
          const draftField = draftFieldIndex.get(templateField.fieldKey);
          return buildFieldFromCandidate({
            key: templateField.fieldKey,
            label: templateField.label,
            candidate,
            fallbackValue: draftField?.manualOverride ?? draftField?.value ?? null,
            fallbackSource: draftField?.manualOverride ? "agent" : "system",
            draftStatus: draftField?.status
          });
        })
        .filter((field: ExtractionReviewField) => field.value || field.status === "missing");

      if (!extraFields.length) return null;
      const meta = sectionMeta(section.key);
      return {
        id: `template-${section.key}`,
        title: section.title,
        description: section.description || meta.description,
        icon: meta.icon,
        tabIds: ["application", primaryApplicantTab],
        fields: extraFields
      } satisfies ExtractionReviewSection;
    })
    .filter(Boolean) as ExtractionReviewSection[] | undefined;

  sections.push(...(templateCatchAllSections ?? []));

  const missingRequiredFields = sections.reduce((count, section) => count + section.fields.filter((field) => field.status === "missing").length, 0);
  const weakDocuments = documentFacts.filter((document) => document.weakOcr || document.autofillCriticalFieldsAllowed === false);
  const conflictingDraftFields = draft?.fields.filter((field) => field.status === "CONFLICTING") ?? [];

  const flags: ExtractionReviewFlag[] = [
    ...(matter.documents.length === 0 ? [{
      id: "no-documents",
      severity: "critical" as const,
      title: "No matter documents uploaded",
      reason: "Upload documents before relying on extraction review or AI draft autofill.",
      evidence: "This matter currently has 0 uploaded documents.",
      recommendedAction: "Upload identity, CoE, English, and supporting evidence files.",
      href: `/app/documents?matterId=${matter.id}`,
      reviewEnabled: false,
      reviewReason: "Review workflow begins after secure document upload."
    }] : []),
    ...matter.checklistItems.filter((item) => item.required && !item.documentId).map((item) => ({
      id: `checklist-${item.id}`,
      severity: "warning" as const,
      title: `Missing checklist evidence: ${item.label}`,
      reason: item.description || "Required evidence is not yet linked to a document.",
      evidence: "Checklist requirement stored on this matter has no linked document.",
      recommendedAction: "Upload the missing document or link existing evidence.",
      href: `/app/matters/${matter.id}/checklist`,
      reviewEnabled: false,
      reviewReason: "Checklist review is routed through the matter checklist workspace."
    })),
    ...weakDocuments.map((document) => ({
      id: `weak-ocr-${document.id}`,
      severity: "warning" as const,
      title: `Document quality warning: ${document.fileName}`,
      reason: document.qualityStatus ?? "The stored extraction preview is weak or limited.",
      evidence: document.qualityWarnings[0] ?? `${document.fileName} does not yet provide strong readable text evidence.`,
      recommendedAction: document.reuploadMessage ?? "Review the original upload manually or request a clearer copy.",
      href: `/app/documents/${document.id}`,
      reviewEnabled: false,
      reviewReason: "OCR quality review is routed through the document detail page."
    })),
    ...conflictingDraftFields.map((field) => ({
      id: `draft-conflict-${field.id}`,
      severity: "critical" as const,
      title: `Conflicting draft field: ${field.templateField.label}`,
      reason: "Aria found contradictory or weak evidence for this field.",
      evidence: field.notes || "The matter draft currently marks this field as conflicting.",
      recommendedAction: "Review the field evidence and decide manually.",
      href: `/app/matters/${matter.id}/draft`,
      reviewEnabled: false,
      reviewReason: "Draft field resolution is handled in the draft review workspace."
    })),
    ...(candidateFor("health.oshc_provider", "oshc_provider") && !candidateFor("health.cover_end", "oshc_end") ? [{
      id: "insurance-missing-end-date",
      severity: "warning" as const,
      title: "Insurance coverage missing end date",
      reason: "An insurer/provider appears to be extracted, but no cover end date is visible.",
      evidence: "OSHC / OVHC evidence is incomplete for review purposes.",
      recommendedAction: "Confirm the policy schedule and end date against the uploaded insurance evidence.",
      href: `/app/matters/${matter.id}/review`,
      reviewEnabled: false,
      reviewReason: "Use source evidence and draft review before marking as resolved."
    }] : []),
    ...(matter.visaSubclass === "500" && !candidateFor("study.coe_number", "coe_number") ? [{
      id: "coe-missing",
      severity: "critical" as const,
      title: "CoE evidence missing",
      reason: "Subclass 500 review currently has no visible CoE number in stored extracted evidence.",
      evidence: "No CoE field has been extracted or linked yet.",
      recommendedAction: "Upload the CoE or verify the education evidence source.",
      href: `/app/documents?matterId=${matter.id}`,
      reviewEnabled: false,
      reviewReason: "Upload or link the missing document first."
    }] : [])
  ];

  const tabsWithFlags = tabs.map((tab) => ({
    ...tab,
    flagCount: tab.id === "application"
      ? flags.length
      : tab.id === primaryApplicantTab
        ? flags.filter((flag) => !flag.id.startsWith("checklist-")).length
        : relatedPeople.find((person) => person.tabId === tab.id)?.flagCount ?? 0
  }));

  const draftStats = {
    mapped: draft?.fields.filter((field) => Boolean(field.value || field.manualOverride)).length ?? 0,
    verified: draft?.fields.filter((field) => field.status === "VERIFIED" || field.status === "HIGH_CONFIDENCE").length ?? 0,
    needsReview: draft?.fields.filter((field) => field.status === "NEEDS_REVIEW" || field.status === "SUPPORTED").length ?? 0,
    conflicting: draft?.fields.filter((field) => field.status === "CONFLICTING").length ?? 0,
    missing: draft?.fields.filter((field) => field.status === "MISSING").length ?? 0
  };

  const hasExtractedEvidence = documentFacts.some((document) => document.flattenedFields.length || safeString(document.extraction.extractedTextPreview));
  const activeFlags = flags.length;

  const documents: ExtractionReviewDocument[] = documentFacts.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    category: document.category,
    extractionStatus: document.extractionStatus,
    reviewStatus: document.reviewStatus,
    extractionConfidence: document.extractionConfidence,
    weakOcr: document.weakOcr,
    qualityStatus: document.qualityStatus,
    qualityScore: document.qualityScore,
    qualityWarnings: document.qualityWarnings,
    reuploadMessage: document.reuploadMessage,
    autofillCriticalFieldsAllowed: document.autofillCriticalFieldsAllowed,
    linkedDraftFields: document.draftEvidenceLinks.length,
    linkedChecklistItems: document.checklistItems.length,
    downloadHref: `/api/documents/${document.id}/download`
  }));

  const nextActions = uniqueStrings([
    !hasExtractedEvidence ? "Upload documents or run extraction to build this review dashboard." : null,
    activeFlags ? "Resolve the flagged extraction and evidence issues before relying on the draft." : "No major extraction flags are visible yet, but agent review is still required.",
    draftStats.needsReview || draftStats.missing ? "Review missing and review-required draft fields." : null,
    matter.visaSubclass === "500" && !getAiConfigStatus().configured ? "AI is not configured. Add OPENAI_API_KEY to enable draft autofill." : null
  ]);

  const summary: ExtractionReviewSummary = {
    matterId: matter.id,
    matterReference: matter.matterReference ?? matter.id.slice(0, 8),
    applicantName: `${matter.client.firstName} ${matter.client.lastName}`,
    visaSubclass: matter.visaSubclass,
    visaStream: matter.visaStream,
    location: firstPayloadValue("current_location", "location"),
    draftReadiness: draft?.readinessScore ?? matter.readinessScore,
    activeFlags,
    uploadedDocuments: matter.documents.length,
    missingRequiredFields,
    lastExtractionAt: formatDateTime(documentFacts.find((document) => document.extractionResults[0]?.createdAt)?.extractionResults[0]?.createdAt),
    reviewStatus: activeFlags ? "Needs review" : hasExtractedEvidence ? "Review in progress" : "Awaiting extraction",
    currentTabId: "application",
    hasExtractedEvidence,
    aiConfigured: getAiConfigStatus().configured,
    encryptionConfigured: getEncryptionConfigStatus().configured,
    reviewHref: `/app/matters/${matter.id}/review`,
    draftHref: `/app/matters/${matter.id}/draft`,
    documentsHref: `/app/documents?matterId=${matter.id}`,
    formsHref: `/app/matters/${matter.id}/forms`,
    generatedDocumentsHref: `/app/matters/${matter.id}/generated-documents`,
    exportHref: `/api/settings/data/export-folder?matterId=${matter.id}`,
    portalHref: `/app/matters/${matter.id}#client-portal-access`,
    canRunAiDraftAutofill: hasPermission(user, "can_access_ai") && matter.documents.length > 0,
    canRunCrossCheck: hasPermission(user, "can_run_cross_check")
  };

  return {
    summary,
    tabs: tabsWithFlags,
    sections,
    people: [{
      id: matter.client.id,
      tabId: primaryApplicantTab,
      role: "Primary applicant",
      name: `${matter.client.firstName} ${matter.client.lastName}`,
      status: summary.reviewStatus,
      flagCount: activeFlags,
      fields: primaryApplicantFields
    }, ...relatedPeople],
    documents,
    flags,
    nextActions,
    draftStats
  };
}
