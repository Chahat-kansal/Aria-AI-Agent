import { PDFDocument } from "pdf-lib";
import {
  DraftFieldStatus,
  OfficialFormLifecycleStatus,
  OfficialFormSupportStatus,
  MatterStage,
  MatterStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import {
  createOrGetMatterDraft,
  getDraftReviewData,
  mapDocumentsToDraft,
  updateDraftFieldReview,
  uploadDocumentToMatter
} from "@/lib/services/application-draft";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { buildMatterClientConfirmationItems } from "@/lib/services/client-confirmation";
import { generateChecklistForMatter } from "@/lib/services/client-workflows";
import { getSubclassSupport } from "@/lib/services/subclass-support";
import { listDraftFieldDefinitions } from "@/lib/services/application-draft-fields";
import { getVisaSubclassDefinition, normalizeVisaSubclassCode, type VisaFieldDefinition } from "@/lib/services/visa-field-definitions";
import { detectFillableFields, generateMatterFormDraft, saveManualFieldMapping } from "@/lib/services/pdf-form-engine";

const WORKSPACE_NAME = "Aria Subclass Autofill Readiness Pty Ltd";
const WORKSPACE_SLUG = "aria-subclass-autofill-readiness";
const TARGET_SUBCLASSES = ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"] as const;

type FixtureDocument = {
  fileName: string;
  category: string;
  extractedText: string;
  keyValues: Array<{ key: string; value: string; confidence: number }>;
};

function slugFragment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function titleCase(value: string) {
  return value
    .split(/[_\s.]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function documentFileName(subclassCode: string, category: string) {
  const prefix = slugFragment(subclassCode);
  switch (category) {
    case "Identity":
      return `${prefix}-passport.pdf`;
    case "Travel":
      return `${prefix}-visa-grant.pdf`;
    case "Education":
      return `${prefix}-education.pdf`;
    case "Employment":
      return `${prefix}-employment-reference.pdf`;
    case "Financial":
      return `${prefix}-bank-statement.pdf`;
    case "Relationship":
      return `${prefix}-relationship-statement.pdf`;
    case "Health / Insurance":
      return `${prefix}-health-insurance.pdf`;
    case "Statements / Declarations":
      return `${prefix}-declaration-statement.pdf`;
    case "Forms":
      return `${prefix}-nomination-form.pdf`;
    default:
      return `${prefix}-supporting-evidence.pdf`;
  }
}

function sampleValueForField(subclassCode: string, field: VisaFieldDefinition) {
  const key = field.fieldKey;
  const normalizedSubclass = normalizeVisaSubclassCode(subclassCode);

  if (/full_name/.test(key)) return normalizedSubclass.startsWith("309") || normalizedSubclass.startsWith("820") ? "Dummy Partner Applicant" : "Dummy Applicant";
  if (/sponsor\.full_name/.test(key)) return "Dummy Sponsor";
  if (/primary_holder/.test(key)) return "Dummy Primary Visa Holder";
  if (/date_of_birth/.test(key)) return "02 Aug 1999";
  if (/grant_date/.test(key)) return "14 Mar 2025";
  if (/expiry|end_date|cover_end|validity/.test(key)) return "31 Aug 2028";
  if (/start_date|cover_start|test_date|issue_date/.test(key)) return "15 Jul 2026";
  if (/sex/.test(key)) return "Female";
  if (/nationality/.test(key)) return "Indian";
  if (/passport_number/.test(key)) return "X7894485";
  if (/passport_country|country_of_birth/.test(key)) return "India";
  if (/place_of_birth/.test(key)) return "New Delhi";
  if (/current_location/.test(key)) return normalizedSubclass === "309/100" ? "Offshore - India" : "Australia";
  if (/residential_address/.test(key)) return "10 Dummy Street, Melbourne VIC 3000";
  if (/phone/.test(key)) return "+61 400 000 000";
  if (/email/.test(key)) return "dummy.applicant@example.com";
  if (/current_visa_subclass/.test(key)) return "485";
  if (/grant_number/.test(key)) return "GRANT-778899";
  if (/relationship_to_primary/.test(key)) return "Spouse";
  if (/qualification/.test(key)) return "Master of Information Technology";
  if (/provider|institution/.test(key)) return "Aria Institute of Technology";
  if (/provider_code|cricos/.test(key)) return "12345A";
  if (/course_name/.test(key)) return "Master of Information Technology";
  if (/two_academic_year_requirement/.test(key)) return "92 CRICOS weeks evidenced by CoE and completion letter";
  if (/english\.test_type/.test(key)) return "PTE Academic";
  if (/english\.overall_score/.test(key)) return "79";
  if (/english\.reference_number/.test(key)) return "PTE-2026-7788";
  if (/skills\.assessment_reference/.test(key)) return "SKILL-2026-4455";
  if (/skills\.assessment_outcome/.test(key)) return "Positive";
  if (/assessing_authority/.test(key)) return "VETASSESS";
  if (/occupation/.test(key)) return "Software Engineer";
  if (/anzsco/.test(key)) return "261313";
  if (/business_name|employer/.test(key)) return "Aria Sponsor Pty Ltd";
  if (/abn/.test(key)) return "12 345 678 901";
  if (/acn/.test(key)) return "123 456 789";
  if (/nomination_details/.test(key)) return "Nomination approved for full-time Software Engineer role";
  if (/nomination\.state/.test(key)) return "Victoria";
  if (/nomination\.reference/.test(key)) return "NOM-190-7788";
  if (/nomination\.regional_support/.test(key)) return "Eligible relative sponsor in regional NSW";
  if (/position_title/.test(key)) return "Software Engineer";
  if (/salary|market_rate|funds|financial\.support_amount/.test(key)) return "85000";
  if (/work_location/.test(key)) return "Sydney NSW";
  if (/duties/.test(key)) return "Develop and maintain enterprise software systems";
  if (/employment_history|reference/.test(key)) return "Five years of skilled employment evidenced by reference letters and payslips";
  if (/relationship\.start_date/.test(key)) return "01 Feb 2021";
  if (/marriage_or_defacto_date/.test(key)) return "15 Jun 2022";
  if (/cohabitation/.test(key)) return "Joint lease and utility bills evidence";
  if (/financial_evidence/.test(key)) return "Joint bank account and shared expenses";
  if (/household_evidence/.test(key)) return "Shared lease, mail, and utilities";
  if (/social_evidence/.test(key)) return "Photos, social invitations, and family statements";
  if (/commitment_evidence/.test(key)) return "Wills, travel bookings, and future planning records";
  if (/timeline/.test(key)) return "Met in 2020, started relationship in 2021, moved in together in 2022, married in 2023";
  if (/separation_periods/.test(key)) return "No separation periods disclosed";
  if (/future_plans/.test(key)) return "Client supplied future plans to continue living together in Australia";
  if (/witness/.test(key)) return "Two supporting witnesses available for Form 888";
  if (/communication_history/.test(key)) return "Screenshots and call logs show ongoing communication";
  if (/travel_visits/.test(key)) return "Multiple mutual visits evidenced by flight itineraries and hotel bookings";
  if (/status$/.test(key)) return "Australian citizen";
  if (/citizenship|pr status/.test(key)) return "Australian citizen";
  if (/english\.exemption/.test(key)) return "No exemption claimed";
  if (/points\./.test(key)) {
    if (/total/.test(key)) return "85";
    if (/english/.test(key)) return "20";
    if (/age/.test(key)) return "30";
    return "5";
  }
  if (/purpose/.test(key)) return "Tourism and visiting family";
  if (/itinerary/.test(key)) return "Sydney 10 days, Melbourne 5 days, return flight booked";
  if (/invitation/.test(key)) return "Invitation letter from cousin in Sydney";
  if (/accommodation/.test(key)) return "Hotel bookings and family accommodation letter";
  if (/home_ties/.test(key)) return "Permanent employment, close family, and leased property in home country";
  if (/travel_history/.test(key)) return "Prior compliant travel to Singapore and New Zealand";
  if (/refusals|cancellations|criminal_history|compliance_history/.test(key)) return "No";
  if (/oshc_provider|insurance provider|insurer/.test(key)) return "Bupa";
  if (/policy_number/.test(key)) return "POL-2026-7788";
  if (/health\.declarations/.test(key)) return "No material health issues disclosed";
  if (/character\.declarations/.test(key)) return "No material character issues disclosed";
  if (/signature/.test(key)) return "Client signature pending";
  if (field.valueType === "BOOLEAN") return "Yes";
  if (field.valueType === "NUMBER") return "1";
  return `${titleCase(key.split(".").slice(-1)[0])} evidenced`;
}

function buildFixtureDocuments(subclassCode: string) {
  const definition = getVisaSubclassDefinition(subclassCode);
  const byCategory = new Map<string, FixtureDocument>();

  const upsertCategory = (category: string) => {
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        fileName: documentFileName(subclassCode, category),
        category,
        extractedText: `${subclassCode} evidence\n`,
        keyValues: []
      });
    }
    return byCategory.get(category)!;
  };

  for (const field of definition.sections.flatMap((section) => section.fields)) {
    const category = field.supportedDocumentCategories[0] ?? "Other Evidence";
    const label = field.aliases[0] ?? field.label;
    const value = sampleValueForField(subclassCode, field);
    const doc = upsertCategory(category);
    doc.extractedText += `${label}: ${value}\n`;
    doc.keyValues.push({ key: label, value, confidence: field.unsafe ? 0.89 : 0.96 });
  }

  return [...byCategory.values()];
}

async function upsertWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: WORKSPACE_NAME, plan: WorkspacePlan.PRO },
    create: { name: WORKSPACE_NAME, slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO }
  });
}

async function upsertUser(input: {
  workspaceId: string;
  email: string;
  name: string;
  role: UserRole;
  visibilityScope: UserVisibilityScope;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      workspaceId: input.workspaceId,
      name: input.name,
      role: input.role,
      status: UserStatus.ACTIVE,
      visibilityScope: input.visibilityScope,
      permissionsJson: defaultPermissionsForRole(input.role),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId: input.workspaceId,
      email: input.email,
      name: input.name,
      role: input.role,
      status: UserStatus.ACTIVE,
      visibilityScope: input.visibilityScope,
      permissionsJson: defaultPermissionsForRole(input.role),
      inviteAcceptedAt: new Date()
    }
  });
}

async function createHarnessMatter(input: {
  workspaceId: string;
  assignedToUserId: string;
  subclassCode: string;
  visaStream: string;
  runSuffix: string;
}) {
  const unique = `${input.runSuffix}-${slugFragment(input.subclassCode)}-${Math.random().toString(36).slice(2, 8)}`;
  const client = await prisma.client.create({
    data: {
      clientReference: `CL-${unique}`.toUpperCase(),
      workspaceId: input.workspaceId,
      assignedToUserId: input.assignedToUserId,
      firstName: "Dummy",
      lastName: `${slugFragment(input.subclassCode).toUpperCase()} Applicant`,
      email: `dummy-${slugFragment(input.subclassCode)}-${unique}@example.com`,
      phone: "0400000000",
      dob: new Date("1999-08-02T00:00:00.000Z"),
      nationality: "Indian"
    }
  });

  return prisma.matter.create({
    data: {
      matterReference: `MAT-${slugFragment(input.subclassCode)}-${unique}`.toUpperCase(),
      workspaceId: input.workspaceId,
      clientId: client.id,
      title: `Subclass autofill readiness ${input.subclassCode} ${unique}`,
      visaSubclass: input.subclassCode,
      visaStream: input.visaStream,
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.INTAKE,
      assignedToUserId: input.assignedToUserId,
      readinessScore: 0
    }
  });
}

async function ensureTemplateDraft(workspaceId: string, matterId: string, subclassCode: string, userId: string) {
  const existing = await prisma.officialFormTemplate.findFirst({
    where: {
      workspaceId,
      formNumber: { startsWith: `AUTO-MAP-${slugFragment(subclassCode)}-` }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) {
    return generateMatterFormDraft({ matterId, templateId: existing.id });
  }

  const fields = listDraftFieldDefinitions(subclassCode).slice(0, 6);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  let y = 760;
  for (const field of fields) {
    form.createTextField(field.label).addToPage(page, { x: 40, y, width: 320, height: 18 });
    y -= 32;
  }
  const pdfBytes = Buffer.from(await pdf.save());
  const inspection = await detectFillableFields(pdfBytes);

  const template = await prisma.officialFormTemplate.create({
    data: {
      workspaceId,
      createdByUserId: userId,
      sourceType: "FIRM_TEMPLATE",
      formNumber: `AUTO-MAP-${slugFragment(subclassCode)}-${Date.now()}`,
      title: `Autofill readiness template ${subclassCode}`,
      category: "Testing",
      sourceName: WORKSPACE_NAME,
      subclassCodes: [subclassCode],
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: OfficialFormSupportStatus.FILLABLE_PDF,
      isFirmProvided: true,
      downloadedAt: new Date(),
      lastCheckedAt: new Date(),
      fileName: `${slugFragment(subclassCode)}-template.pdf`,
      mimeType: "application/pdf",
      fileData: pdfBytes,
      fieldSchemaJson: inspection.fields
    }
  });

  await saveManualFieldMapping(
    template.id,
    Object.fromEntries(fields.map((field) => [field.label, field.fieldKey]))
  );

  return generateMatterFormDraft({ matterId, templateId: template.id });
}

async function runSubclassTest(input: {
  workspaceId: string;
  ownerId: string;
  assignedToUserId: string;
  subclassCode: string;
  runSuffix: string;
}) {
  const definition = getVisaSubclassDefinition(input.subclassCode);
  const matter = await createHarnessMatter({
    workspaceId: input.workspaceId,
    assignedToUserId: input.assignedToUserId,
    subclassCode: input.subclassCode,
    visaStream: definition.stream,
    runSuffix: input.runSuffix
  });

  await generateChecklistForMatter(matter.id, input.ownerId);

  for (const doc of buildFixtureDocuments(input.subclassCode)) {
    await uploadDocumentToMatter({
      matterId: matter.id,
      fileName: doc.fileName,
      mimeType: "application/pdf",
      extractedText: doc.extractedText,
      extractionMetadata: {
        provider: "subclass-harness",
        model: "dummy-key-value-fixture",
        confidence: 0.96,
        warnings: ["Dummy subclass autofill harness evidence."],
        configured: true,
        keyValues: doc.keyValues,
        extractedTextPreview: doc.extractedText.slice(0, 1000)
      },
      uploadedByUserId: input.assignedToUserId,
      skipDraftMapping: true,
      overrideCategory: doc.category
    });
  }

  await createOrGetMatterDraft(matter.id);
  let reviewData = await mapDocumentsToDraft(matter.id, { skipAiSuggestions: true });

  const requiredFields = reviewData.draft.fields.filter((field: any) => field.templateField.required);
  const requiredWithValues = requiredFields.filter((field: any) => field.value || field.manualOverride);
  const sourceBackedRequired = requiredWithValues.filter((field: any) => field.sourceSnippet && typeof field.confidence === "number");
  const unsafeFields = reviewData.draft.fields.filter((field: any) => {
    const rules = field.templateField.validationRules as Record<string, unknown> | null | undefined;
    return Boolean(rules?.unsafe);
  });

  const fieldToVerify = reviewData.draft.fields.find((field: any) =>
    !((field.templateField.validationRules as Record<string, unknown> | null | undefined)?.unsafe)
    && field.value
  );

  let verifiedFieldProtected = false;
  if (fieldToVerify) {
    const beforeValue = fieldToVerify.value;
    await updateDraftFieldReview({ draftFieldId: fieldToVerify.id, status: DraftFieldStatus.VERIFIED });
    reviewData = await mapDocumentsToDraft(matter.id, { skipAiSuggestions: true });
    const refreshed = reviewData.draft.fields.find((field: any) => field.id === fieldToVerify.id);
    verifiedFieldProtected = Boolean(refreshed && refreshed.status === DraftFieldStatus.VERIFIED && refreshed.value === beforeValue);
  }

  const confirmationItems = await buildMatterClientConfirmationItems(matter.id);
  const safety = await assessMatterCaseSafety(matter.id);
  const pdfDraft = await ensureTemplateDraft(input.workspaceId, matter.id, input.subclassCode, input.ownerId);
  const support = getSubclassSupport(input.subclassCode);

  const criticalRequiredCoverage = requiredFields.length > 0
    && requiredWithValues.length === requiredFields.length
    && sourceBackedRequired.length === requiredFields.length;

  const unsafeStillNeedsReview = unsafeFields.every((field: any) => field.status !== DraftFieldStatus.VERIFIED);
  const hasExpectedSafety = safety.hardBlockers.length > 0
    && safety.hardBlockers.some((blocker) => blocker.code === "unsafe_field_unverified" || blocker.code === "client_confirmation_missing");

  const passed =
    criticalRequiredCoverage
    && verifiedFieldProtected
    && unsafeStillNeedsReview
    && confirmationItems.length > 0
    && hasExpectedSafety
    && Boolean(pdfDraft.supported && pdfDraft.draft?.id);

  return {
    subclassCode: input.subclassCode,
    matterId: matter.id,
    supportLevel: passed ? "FULL_FIELD_AUTOFILL" : support.supportLevel,
    checks: {
      requiredFieldCount: requiredFields.length,
      requiredWithValues: requiredWithValues.length,
      sourceBackedRequired: sourceBackedRequired.length,
      verifiedFieldProtected,
      unsafeFieldCount: unsafeFields.length,
      unsafeStillNeedsReview,
      clientConfirmationCount: confirmationItems.length,
      hardBlockerCount: safety.hardBlockers.length,
      pdfDraftGenerated: Boolean(pdfDraft.supported && pdfDraft.draft?.id)
    },
    blockers: safety.hardBlockers.map((blocker) => blocker.title),
    missingRequiredFields: requiredFields.filter((field: any) => !field.value && !field.manualOverride).map((field: any) => field.templateField.fieldKey)
  };
}

async function main() {
  const runSuffix = Date.now().toString(36);
  const requestedSubclass = process.argv[2]?.trim();
  const workspace = await upsertWorkspace();
  const owner = await upsertUser({
    workspaceId: workspace.id,
    email: "owner-subclass-readiness+aria@example.com",
    name: "Aria Autofill Owner",
    role: UserRole.COMPANY_OWNER,
    visibilityScope: UserVisibilityScope.FIRM_WIDE
  });
  const agent = await upsertUser({
    workspaceId: workspace.id,
    email: "agent-subclass-readiness+aria@example.com",
    name: "Aria Autofill Agent",
    role: UserRole.MIGRATION_AGENT,
    visibilityScope: UserVisibilityScope.FIRM_WIDE
  });

  const results = [];
  const subclasses = requestedSubclass ? TARGET_SUBCLASSES.filter((code) => code === requestedSubclass) : TARGET_SUBCLASSES;
  const batchSize = requestedSubclass ? 1 : 3;
  for (let i = 0; i < subclasses.length; i += batchSize) {
    const batch = subclasses.slice(i, i + batchSize);
    batch.forEach((subclassCode) => console.log(`[autofill-harness] starting ${subclassCode}`));
    const batchResults = await Promise.all(batch.map((subclassCode) =>
      runSubclassTest({
        workspaceId: workspace.id,
        ownerId: owner.id,
        assignedToUserId: agent.id,
        subclassCode,
        runSuffix
      })
    ));
    results.push(...batchResults);
    batch.forEach((subclassCode) => console.log(`[autofill-harness] finished ${subclassCode}`));
  }

  const failed = results.filter((result) => result.supportLevel !== "FULL_FIELD_AUTOFILL");
  console.log(JSON.stringify({
    workspaceSlug: WORKSPACE_SLUG,
    runSuffix,
    passed: failed.length === 0,
    results
  }, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
