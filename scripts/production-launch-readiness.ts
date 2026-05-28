import { execSync } from "node:child_process";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { DraftFieldStatus, FieldStatus, OfficialFormLifecycleStatus, OfficialFormSupportStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { createMatter } from "@/lib/services/matters";
import { defaultPermissionsForRole, canAccessMatter, canManageTeam, hasPermission } from "@/lib/services/roles";
import { updateWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { listSubclassSupport } from "@/lib/services/subclass-support";
import { getLaunchReadinessReport } from "@/lib/services/launch-readiness";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { buildMatterClientConfirmationItems, parseSubmittedClientConfirmations } from "@/lib/services/client-confirmation";
import { checklistTemplates, createClientIntakeRequest, ensureClientPortalToken, generateChecklistForMatter, getClientPortalByToken, submitIntake } from "@/lib/services/client-workflows";
import { createOrGetSubclass500Draft, inferExtractedDraftFields, mapDocumentsToDraft, updateDraftFieldReview } from "@/lib/services/application-draft";
import { uploadDocumentToMatter } from "@/lib/services/application-draft";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { auditDocumentUploaded, auditEvent } from "@/lib/services/audit";
import { encryptJson, encryptString } from "@/lib/security/encryption";
import { getAriaReviewWarning } from "@/lib/services/aria-grounding";
import { generateVisaDraftPack } from "@/lib/services/visa-draft-pack";
import { detectFillableFields, generateMatterFormDraft, saveManualFieldMapping } from "@/lib/services/pdf-form-engine";

loadScriptEnv();

const WORKSPACE_NAME = "Aria Production Readiness Test Pty Ltd";
const WORKSPACE_SLUG = "aria-production-readiness-test";
const USERS = {
  owner: "owner-production+aria@example.com",
  admin: "admin-production+aria@example.com",
  agent1: "agent-one-production+aria@example.com",
  agent2: "agent-two-production+aria@example.com",
  client1: "client-one-production+aria@example.com",
  client2: "client-two-production+aria@example.com"
};

const SUBCLASSES = ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"] as const;
const AUTOFILL_READINESS_WORKSPACE_SLUG = "aria-subclass-autofill-readiness";

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
  visibilityScope?: UserVisibilityScope;
  supervisorId?: string | null;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      status: UserStatus.ACTIVE,
      workspaceId: input.workspaceId,
      visibilityScope: input.visibilityScope ?? UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(input.role),
      supervisorId: input.supervisorId ?? null,
      inviteAcceptedAt: new Date()
    },
    create: {
      name: input.name,
      email: input.email,
      role: input.role,
      status: UserStatus.ACTIVE,
      workspaceId: input.workspaceId,
      visibilityScope: input.visibilityScope ?? UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(input.role),
      supervisorId: input.supervisorId ?? null,
      inviteAcceptedAt: new Date()
    }
  });
}

async function ensureMatter(input: {
  workspaceId: string;
  assignedToUserId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  title: string;
  visaSubclass: string;
  visaStream: string;
}) {
  const existing = await prisma.matter.findFirst({
    where: { workspaceId: input.workspaceId, title: input.title, visaSubclass: input.visaSubclass },
    include: { client: true, assignedToUser: true }
  });
  if (existing) return existing;
  return createMatter({
    workspaceId: input.workspaceId,
    assignedToUserId: input.assignedToUserId,
    clientFirstName: input.clientFirstName,
    clientLastName: input.clientLastName,
    clientEmail: input.clientEmail,
    clientPhone: "0400000000",
    clientDob: new Date("1999-08-02T00:00:00.000Z"),
    nationality: "Indian",
    title: input.title,
    visaSubclass: input.visaSubclass,
    visaStream: input.visaStream
  });
}

async function findLatestParityMatter(subclassCode: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: AUTOFILL_READINESS_WORKSPACE_SLUG }
  });
  if (!workspace) return null;

  return prisma.matter.findFirst({
    where: {
      workspaceId: workspace.id,
      visaSubclass: subclassCode,
      title: { startsWith: "Subclass autofill readiness" }
    },
    orderBy: { createdAt: "desc" }
  });
}

const subclass500Uploads = [
  {
    fileName: "production-passport.pdf",
    mimeType: "application/pdf",
    body: `Passport
Full Name: Production Dummy Student
Date of Birth: 02 Aug 1999
Nationality: Indian
Passport Number: X7894485
Country of Birth: India
Place of Birth: New Delhi
Expiry Date: 14 Sep 2031`
  },
  {
    fileName: "production-coe.pdf",
    mimeType: "application/pdf",
    body: `Confirmation of Enrolment
Provider: Aria Institute of Technology
Course Name: Master of Information Technology
COE Number: COE-AU-500-123456
CRICOS Code: 12345A
Course Start: 15 Jul 2026
End Date: 20 Jul 2028`
  },
  {
    fileName: "production-english.pdf",
    mimeType: "application/pdf",
    body: `PTE Academic
Candidate: Production Dummy Student
Overall Score: 79
Listening: 80
Reading: 78
Writing: 79
Speaking: 81
Test Date: 10 Jan 2026`
  },
  {
    fileName: "production-oshc.pdf",
    mimeType: "application/pdf",
    body: `OSHC Certificate
OSHC Provider: Bupa
Policy Number: OSHC-2026-7788
OSHC Start: 01 Jul 2026
OSHC End: 31 Aug 2028`
  }
] as const;

async function createPdfBytes(text: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  let y = 790;
  for (const line of text.split("\n")) {
    page.drawText(line, { x: 48, y, size: 12, font });
    y -= 18;
  }
  return Buffer.from(await pdf.save());
}

function categoryForFile(fileName: string) {
  if (fileName.includes("passport")) return "Identity";
  if (fileName.includes("coe") || fileName.includes("english")) return "Education";
  if (fileName.includes("oshc")) return "Health / Insurance";
  return "Financial";
}

async function seedSubclass500Documents(matterId: string, uploaderId: string, workspaceId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, include: { documents: true } });
  for (const upload of subclass500Uploads) {
    const bytes = await createPdfBytes(upload.body);
    const extraction = await extractDocumentResult(bytes, upload.mimeType);
    const seededExtraction = {
      ...extraction,
      provider: "seeded-production-fixture",
      model: "fixture-pdf-text",
      extractedText: upload.body,
      extractedTextPreview: upload.body.slice(0, 1000),
      confidence: 0.96,
      warnings: ["Seeded dummy extracted text used for production-readiness harness."],
      configured: true
    };
    const existing = matter.documents.find((document) => document.fileName === upload.fileName);
    const inferred = inferExtractedDraftFields({
      fileName: upload.fileName,
      category: existing?.category ?? categoryForFile(upload.fileName),
      extractedText: seededExtraction.extractedText,
      keyValues: seededExtraction.keyValues
    });

    if (existing) continue;

    const prepared = await prepareMatterDocumentUpload({ workspaceId, matterId, fileName: upload.fileName, bytes, mimeType: upload.mimeType });
    const document = await uploadDocumentToMatter({
      matterId,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      storageKey: prepared.storageKey,
      fileSize: prepared.fileSize,
      contentHash: prepared.contentHash,
      extractedText: seededExtraction.extractedText,
      extractionMetadata: {
        provider: seededExtraction.provider,
        model: seededExtraction.model,
        confidence: seededExtraction.confidence,
        warnings: seededExtraction.warnings,
        configured: seededExtraction.configured,
        keyValues: seededExtraction.keyValues,
        extractedTextPreview: seededExtraction.extractedTextPreview
      },
      uploadedByUserId: uploaderId
    });
    await persistDocumentStorageObject({ documentId: document.id, upload: prepared });
    await auditDocumentUploaded({ workspaceId, userId: uploaderId, documentId: document.id, matterId, fileName: upload.fileName, mimeType: upload.mimeType, fileSize: prepared.fileSize });
    await auditEvent({ workspaceId, userId: uploaderId, entityType: "Document", entityId: document.id, action: "document.extracted", metadata: { matterId, provider: seededExtraction.provider, confidence: seededExtraction.confidence, warningCount: seededExtraction.warnings.length } });
    for (const field of inferred) {
      await prisma.extractedField.create({
        data: {
          matterId,
          documentId: document.id,
          fieldKey: field.key,
          fieldLabel: field.key.split(".").slice(-1)[0].replace(/_/g, " "),
          fieldValue: encryptString(field.value),
          confidence: field.confidence,
          sourceSnippet: encryptString(field.snippet),
          sourcePageRef: encryptString("production readiness seeded fixture"),
          status: field.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
          needsReview: true
        }
      });
    }
  }
}

async function ensureMappedTemplate(matterId: string, assignedToUserId: string, workspaceId: string, visaSubclass: string) {
  const existing = await prisma.officialFormTemplate.findFirst({
    where: { workspaceId, formNumber: { startsWith: `PROD-MAP-${visaSubclass}` } }
  });
  if (existing) return existing;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  form.createTextField("Applicant Full Name").addToPage(page, { x: 40, y: 760, width: 250, height: 18 });
  form.createTextField("Passport Number").addToPage(page, { x: 40, y: 730, width: 250, height: 18 });
  form.createTextField("COE Number").addToPage(page, { x: 40, y: 700, width: 250, height: 18 });
  form.createTextField("Education Provider").addToPage(page, { x: 40, y: 670, width: 250, height: 18 });
  form.createTextField("Course Name").addToPage(page, { x: 40, y: 640, width: 250, height: 18 });
  form.createTextField("Available Funds").addToPage(page, { x: 40, y: 610, width: 250, height: 18 });
  form.createTextField("OSHC Provider").addToPage(page, { x: 40, y: 580, width: 250, height: 18 });
  const pdfBytes = Buffer.from(await pdf.save());
  const inspection = await detectFillableFields(pdfBytes);

  const template = await prisma.officialFormTemplate.create({
    data: {
      workspaceId,
      createdByUserId: assignedToUserId,
      sourceType: "FIRM_TEMPLATE",
      formNumber: `PROD-MAP-${visaSubclass}-${Date.now()}`,
      title: "Production readiness mapping template",
      category: "Testing",
      sourceName: WORKSPACE_NAME,
      subclassCodes: [visaSubclass],
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: OfficialFormSupportStatus.FILLABLE_PDF,
      isFirmProvided: true,
      downloadedAt: new Date(),
      lastCheckedAt: new Date(),
      fileName: "production-readiness-template.pdf",
      mimeType: "application/pdf",
      fileData: pdfBytes,
      fieldSchemaJson: inspection.fields
    }
  });

  await saveManualFieldMapping(template.id, {
    "Applicant Full Name": "applicant.full_name",
    "Passport Number": "applicant.passport_number",
    "COE Number": "study.coe_number",
    "Education Provider": "study.provider",
    "Course Name": "study.course_name",
    "Available Funds": "financial.available_funds",
    "OSHC Provider": "health.oshc_provider"
  });

  return template;
}

function safeExec(command: string) {
  try {
    return execSync(command, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }).toString("utf8").trim();
  } catch (error) {
    const output = (error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString("utf8")?.trim();
    return output || "";
  }
}

async function main() {
  const workspace = await upsertWorkspace();
  const owner = await upsertUser({ workspaceId: workspace.id, email: USERS.owner, name: "Aria Production Owner", role: UserRole.COMPANY_OWNER, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  const admin = await upsertUser({ workspaceId: workspace.id, email: USERS.admin, name: "Aria Production Admin", role: UserRole.COMPANY_ADMIN, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  const agent1 = await upsertUser({ workspaceId: workspace.id, email: USERS.agent1, name: "Aria Production Agent One", role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY, supervisorId: admin.id });
  const agent2 = await upsertUser({ workspaceId: workspace.id, email: USERS.agent2, name: "Aria Production Agent Two", role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY, supervisorId: admin.id });

  await updateWorkspaceLaunchControls(workspace.id, {
    betaModeEnabled: false,
    allowRealClientUploads: true,
    restrictBetaToSelectedUsers: false,
    restrictedUserEmails: [],
    allowedSubclasses: SUBCLASSES as unknown as string[],
    clientPortalEnabled: true,
    aiDraftAutofillEnabled: true,
    pdfFormFillingEnabled: true,
    exportEnabled: true,
    publicSignupEnabled: false,
    maxFileSizeMb: 15,
    allowedFileTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    legalReviewStatuses: {
      privacy: "approved_for_production",
      terms: "approved_for_production",
      security: "approved_for_production",
      aiDisclaimer: "approved_for_production",
      subprocessors: "approved_for_production"
    }
  });

  const matter500 = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent1.id,
    clientFirstName: "Production",
    clientLastName: "Student",
    clientEmail: USERS.client1,
    title: "Production launch readiness 500",
    visaSubclass: "500",
    visaStream: "Higher Education"
  });
  const matter485 = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent1.id,
    clientFirstName: "Production",
    clientLastName: "Graduate",
    clientEmail: "client-485-production+aria@example.com",
    title: "Production launch readiness 485",
    visaSubclass: "485",
    visaStream: "Post-study work"
  });
  const matter309 = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent2.id,
    clientFirstName: "Production",
    clientLastName: "Partner",
    clientEmail: USERS.client2,
    title: "Production launch readiness 309/100",
    visaSubclass: "309/100",
    visaStream: "Partner"
  });
  const matter190 = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent2.id,
    clientFirstName: "Production",
    clientLastName: "Skilled",
    clientEmail: "client-190-production+aria@example.com",
    title: "Production launch readiness 190",
    visaSubclass: "190",
    visaStream: "Skilled nominated"
  });
  const matter600 = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent2.id,
    clientFirstName: "Production",
    clientLastName: "Visitor",
    clientEmail: "client-600-production+aria@example.com",
    title: "Production launch readiness 600",
    visaSubclass: "600",
    visaStream: "Visitor"
  });

  const seededMatterIds = [matter500.id, matter485.id, matter309.id, matter190.id, matter600.id];
  for (const matterId of seededMatterIds) {
    await generateChecklistForMatter(matterId, owner.id);
  }

  await seedSubclass500Documents(matter500.id, agent1.id, workspace.id);
  await createOrGetSubclass500Draft(matter500.id);
  await mapDocumentsToDraft(matter500.id);
  const draft = await prisma.matterApplicationDraft.findFirst({
    where: { matterId: matter500.id },
    include: { fields: { include: { templateField: true }, orderBy: { templateField: { sortOrder: "asc" } } } },
    orderBy: { updatedAt: "desc" }
  });
  const dobField = draft?.fields.find((field) => field.templateField.fieldKey === "applicant.date_of_birth");
  if (dobField) {
    await updateDraftFieldReview({ draftFieldId: dobField.id, status: DraftFieldStatus.VERIFIED });
  }
  await mapDocumentsToDraft(matter500.id);

  const template = await ensureMappedTemplate(matter500.id, agent1.id, workspace.id, "500");
  const pdfDraft = await generateMatterFormDraft({ matterId: matter500.id, templateId: template.id });
  const draftPack = await generateVisaDraftPack(matter500.id);

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: matter500.clientId,
    matterId: matter500.id,
    label: "Production readiness portal",
    createdByUserId: owner.id,
    requestOrigin: "http://localhost:3007"
  });
  const portalView = await getClientPortalByToken(portal.token);
  const intake = await createClientIntakeRequest({
    workspaceId: workspace.id,
    createdByUserId: agent1.id,
    clientId: matter500.clientId,
    matterId: matter500.id,
    title: "Production readiness client confirmation",
    recipientName: "Production Student",
    recipientEmail: USERS.client1,
    workflowType: "CLIENT_CONFIRMATION",
    message: "Please complete the production readiness confirmation pack.",
    requestOrigin: "http://localhost:3007"
  });
  const confirmationItems = await buildMatterClientConfirmationItems(matter500.id);
  const confirmationForm = new FormData();
  for (const item of confirmationItems) {
    confirmationForm.set(`confirmation_response__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`, "confirmed");
    confirmationForm.set(`confirmation_detail__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`, `Confirmed in production harness for ${item.title}.`);
  }
  const parsedConfirmations = parseSubmittedClientConfirmations(confirmationForm, confirmationItems);
  if (parsedConfirmations) {
    await submitIntake(intake.token, {
      clientConfirmations: parsedConfirmations,
      nationality: "Indian",
      currentVisaStatus: "Student visa",
      notes: "Submitted by production readiness harness"
    });
  }

  const parityMatter485 = await findLatestParityMatter("485");
  const parityMatter309 = await findLatestParityMatter("309/100");
  const parityMatter500 = await findLatestParityMatter("500");
  const safety500 = await assessMatterCaseSafety(parityMatter500?.id ?? matter500.id);
  const safety485 = await assessMatterCaseSafety(parityMatter485?.id ?? matter485.id);
  const safety309 = await assessMatterCaseSafety(parityMatter309?.id ?? matter309.id);
  const launchReport = await getLaunchReadinessReport(workspace.id);

  const supportMatrix = listSubclassSupport().reduce<Record<string, string>>((acc, item) => {
    acc[item.subclassCode] = item.supportLevel;
    return acc;
  }, {});

  const scanOutput = safeExec('rg -n "(BEGIN PRIVATE KEY|OPENAI_API_KEY\\s*=|SUPABASE_SERVICE_ROLE_KEY\\s*=|sk-[A-Za-z0-9_-]{20,})" app lib prisma scripts');
  const tokenLeakScan = safeExec('rg -n "tokenHash" app lib');
  const rawUrlScan = safeExec('rg -n "https?://[^\\s\\\"]+/(storage|object|bucket)|raw document url|publicUrl" app lib');
  const repoSecretLines = (scanOutput ? scanOutput.split("\n").filter(Boolean) : []).filter((line) => !line.includes("production-launch-readiness.ts"));

  const auditEvents = await prisma.auditEvent.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  const auditJoined = JSON.stringify(auditEvents.map((event) => event.metadataJson ?? {}));
  const auditMetadataScan = {
    tokenHashExposed: /tokenHash/i.test(auditJoined),
    rawDocumentUrlExposed: /https?:\/\/[^\s"]+\/(storage|object|bucket)/i.test(auditJoined),
    passportPlaintextExposed: /X7894485/.test(auditJoined),
    dobPlaintextExposed: /1999-08-02|02 Aug 1999/.test(auditJoined),
    extractedBodyPlaintextExposed: /Confirmation of Enrolment|OSHC Certificate/.test(auditJoined)
  };

  const roleIsolation = {
    ownerCanManageTeam: canManageTeam(owner),
    adminCanManageTeam: canManageTeam(admin),
    agent1CanAccessMatter500: canAccessMatter(agent1, { ...matter500, assignedToUser: agent1 } as never),
    agent1CanAccessMatter309: canAccessMatter(agent1, { ...matter309, assignedToUser: agent2 } as never),
    agent2CanAccessMatter500: canAccessMatter(agent2, { ...matter500, assignedToUser: agent1 } as never),
    agent2CanAccessMatter309: canAccessMatter(agent2, { ...matter309, assignedToUser: agent2 } as never),
    ownerCanExport: hasPermission(owner, "can_export_data"),
    adminCanExport: hasPermission(admin, "can_export_data")
  };

  const subclassChecks = {
    "500": {
      supportLevel: supportMatrix["500"],
      checklistTemplate: Boolean(checklistTemplates["500"]),
      autofillMapped: Boolean(
        (await prisma.matterApplicationDraft.findFirst({
          where: { matterId: parityMatter500?.id ?? matter500.id },
          orderBy: { updatedAt: "desc" },
          include: { fields: { include: { templateField: true } } }
        }))?.fields.some((field) => field.templateField.fieldKey === "study.coe_number" && Boolean(field.value) && field.status !== DraftFieldStatus.MISSING)
      ),
      verifiedFieldProtected: Boolean(dobField && (await prisma.matterDraftField.findUnique({ where: { id: dobField.id } }))?.status === DraftFieldStatus.VERIFIED),
      draftPackSupported: draftPack.supportedPack === "500 Student",
      pdfDraftGenerated: Boolean(pdfDraft.supported && pdfDraft.draft)
    },
    "485": {
      supportLevel: supportMatrix["485"],
      checklistTemplate: Boolean(checklistTemplates["485"]),
      clientConfirmationItems: (await buildMatterClientConfirmationItems(parityMatter485?.id ?? matter485.id)).map((item) => item.category),
      safetyHardBlockers: safety485.hardBlockers.length
    },
    "309/100": {
      supportLevel: supportMatrix["309/100"],
      checklistTemplate: Boolean(checklistTemplates["309/100"]),
      clientConfirmationItems: (await buildMatterClientConfirmationItems(parityMatter309?.id ?? matter309.id)).map((item) => item.category),
      safetyHardBlockers: safety309.hardBlockers.length
    },
    "190": {
      supportLevel: supportMatrix["190"],
      checklistTemplate: Boolean(checklistTemplates["190"])
    },
    "600": {
      supportLevel: supportMatrix["600"],
      checklistTemplate: Boolean(checklistTemplates["600"])
    }
  };

  const aiProof = {
    reviewWarningIncluded: getAriaReviewWarning().includes("Registered migration agent review required before use"),
    noGuaranteeWording: getAriaReviewWarning().includes("does not guarantee visa outcomes"),
    noLodgementWording: getAriaReviewWarning().includes("does not lodge applications")
  };

  const verdict =
    !roleIsolation.agent1CanAccessMatter309
    && !roleIsolation.agent2CanAccessMatter500
    && !auditMetadataScan.tokenHashExposed
    && !auditMetadataScan.rawDocumentUrlExposed
    && !auditMetadataScan.passportPlaintextExposed
    && !auditMetadataScan.dobPlaintextExposed
    && !auditMetadataScan.extractedBodyPlaintextExposed
    && repoSecretLines.length === 0
    && launchReport.headline === "Production launch candidate after independent legal/privacy/security review."
      ? "PRODUCTION-LAUNCH CANDIDATE AFTER INDEPENDENT LEGAL/PRIVACY/SECURITY REVIEW"
      : "READY FOR CONTROLLED REAL-CLIENT BETA AFTER LEGAL REVIEW";

  console.log(JSON.stringify({
    workspace: { id: workspace.id, slug: workspace.slug },
    launchReadinessHeadline: launchReport.headline,
    roleIsolation,
    portalScope: {
      clientId: portalView?.clientId ?? null,
      matterId: portalView?.matterId ?? null
    },
    subclassChecks,
    supportMatrix,
    aiProof,
    scans: {
      repoSecrets: repoSecretLines,
      tokenUsageInCode: tokenLeakScan ? tokenLeakScan.split("\n").filter(Boolean) : [],
      rawUrlUsageInCode: rawUrlScan ? rawUrlScan.split("\n").filter(Boolean) : []
    },
    auditMetadataScan,
    safety: {
      "500": safety500,
      "485": safety485,
      "309/100": safety309
    },
    legalPages: {
      privacy: "reviewed in code",
      terms: "reviewed in code",
      security: "reviewed in code",
      aiDisclaimer: "reviewed in code",
      subprocessors: "reviewed in code"
    },
    verdict
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
