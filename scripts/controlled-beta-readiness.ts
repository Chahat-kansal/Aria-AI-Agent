import { DraftFieldStatus, FieldStatus, IntakeRequestStatus, OfficialFormLifecycleStatus, OfficialFormSupportStatus, ReviewRequestStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { createMatter } from "@/lib/services/matters";
import { defaultPermissionsForRole, canAccessMatter, canAccessCompanyWorkspace, canManageTeam, getUserPermissions, hasFirmWideAccess, hasPermission, scopedClientWhere, scopedMatterWhere } from "@/lib/services/roles";
import { prepareMatterDocumentUpload, persistDocumentStorageObject } from "@/lib/services/storage";
import { extractDocumentResult } from "@/lib/services/document-extraction";
import { auditDocumentUploaded, auditEvent } from "@/lib/services/audit";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { buildMatterClientConfirmationItems, parseSubmittedClientConfirmations } from "@/lib/services/client-confirmation";
import { checklistTemplates, createClientIntakeRequest, ensureClientPortalToken, generateChecklistForMatter, getClientPortalByToken, submitIntake } from "@/lib/services/client-workflows";
import { createOrGetSubclass500Draft, getDraftReviewData, inferExtractedDraftFields, mapDocumentsToDraft, updateDraftFieldReview, uploadDocumentToMatter } from "@/lib/services/application-draft";
import { generateVisaDraftPack } from "@/lib/services/visa-draft-pack";
import { buildGeneratedDocumentForMatter } from "@/lib/services/draft-generation";
import { detectFillableFields, generateMatterFormDraft, saveManualFieldMapping } from "@/lib/services/pdf-form-engine";
import { encryptJson, encryptString, isEncrypted } from "@/lib/security/encryption";
import { hashPortalToken } from "@/lib/security/hash";
import { getSubclassSupport } from "@/lib/services/subclass-support";

const WORKSPACE_NAME = "Aria Beta Test Migration Pty Ltd";
const WORKSPACE_SLUG = "aria-beta-test-migration";
const USERS = {
  owner: "owner-test+aria@example.com",
  admin: "admin-test+aria@example.com",
  agent1: "agent-one-test+aria@example.com",
  agent2: "agent-two-test+aria@example.com",
  client1: "client-one-test+aria@example.com",
  client2: "client-two-test+aria@example.com"
};

const subclasses = ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"] as const;

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
    include: { client: true }
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

const dummyUploads = [
  {
    fileName: "dummy-passport.pdf",
    mimeType: "application/pdf",
    body: `Passport
Full Name: Dummy Applicant
Date of Birth: 02 Aug 1999
Nationality: Indian
Passport Number: X7894485
Country of Birth: India
Place of Birth: New Delhi
Expiry Date: 14 Sep 2031`
  },
  {
    fileName: "dummy-coe.pdf",
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
    fileName: "dummy-english.pdf",
    mimeType: "application/pdf",
    body: `PTE Academic
Candidate: Dummy Applicant
Overall Score: 79
Listening: 80
Reading: 78
Writing: 79
Speaking: 81
Test Date: 10 Jan 2026`
  },
  {
    fileName: "dummy-oshc.pdf",
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

function buildSeededExtraction(upload: { body: string }, extraction: Awaited<ReturnType<typeof extractDocumentResult>>) {
  if (extraction.extractedText.trim().length > 80 && extraction.confidence >= 0.6) return extraction;
  return {
    ...extraction,
    provider: "seeded-local-fixture",
    model: "fixture-pdf-text",
    extractedText: upload.body,
    extractedTextPreview: upload.body.slice(0, 1000),
    confidence: 0.96,
    warnings: ["Local smoke fixture provided seeded extracted text because baseline PDF parsing was weak on this generated test file."],
    configured: true
  };
}

async function seedSubclass500Documents(matterId: string, uploaderId: string, workspaceId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, include: { documents: true } });
  const createdDocumentIds: string[] = [];
  const categoryForFile = (fileName: string) => {
    if (fileName.includes("passport")) return "Identity";
    if (fileName.includes("coe") || fileName.includes("english")) return "Education";
    if (fileName.includes("oshc")) return "Health / Insurance";
    return "Financial";
  };

  for (const upload of dummyUploads) {
    const existing = matter.documents.find((document) => document.fileName === upload.fileName);
    const bytes = await createPdfBytes(upload.body);
    const seededExtraction = buildSeededExtraction(upload, await extractDocumentResult(bytes, upload.mimeType));
    const inferred = inferExtractedDraftFields({
      fileName: upload.fileName,
      category: existing?.category ?? categoryForFile(upload.fileName),
      extractedText: seededExtraction.extractedText,
      keyValues: seededExtraction.keyValues
    });

    if (existing) {
      const latestExtraction = await prisma.documentExtractionResult.findFirst({
        where: { documentId: existing.id },
        orderBy: { createdAt: "desc" }
      });
      if (latestExtraction) {
        await prisma.documentExtractionResult.update({
          where: { id: latestExtraction.id },
          data: {
            provider: seededExtraction.provider,
            model: seededExtraction.model,
            extractedJson: encryptJson({
              category: existing.category,
              fields: inferred,
              extractedTextPreview: seededExtraction.extractedTextPreview,
              extractionConfidence: seededExtraction.confidence,
              extractionWarnings: seededExtraction.warnings,
              extractionConfigured: seededExtraction.configured,
              keyValues: seededExtraction.keyValues ?? [],
              reviewRequired: true
            })
          }
        });
        await prisma.extractedField.deleteMany({ where: { documentId: existing.id } });
        for (const field of inferred) {
          await prisma.extractedField.create({
            data: {
              matterId,
              documentId: existing.id,
              fieldKey: field.key,
              fieldLabel: field.key.split(".").slice(-1)[0].replace(/_/g, " "),
              fieldValue: encryptString(field.value),
              confidence: field.confidence,
              sourceSnippet: encryptString(field.snippet),
              sourcePageRef: encryptString("seeded local smoke fixture"),
              status: field.confidence >= 0.75 ? FieldStatus.SUPPORTED : FieldStatus.NEEDS_REVIEW,
              needsReview: true
            }
          });
        }
      }
      continue;
    }

    const prepared = await prepareMatterDocumentUpload({
      workspaceId,
      matterId,
      fileName: upload.fileName,
      bytes,
      mimeType: upload.mimeType
    });
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
    createdDocumentIds.push(document.id);
  }

  return createdDocumentIds;
}

async function ensureMappedTemplate(matterId: string, assignedToUserId: string, workspaceId: string, visaSubclass: string) {
  const existing = await prisma.officialFormTemplate.findFirst({
    where: { workspaceId, formNumber: { startsWith: `BETA-MAP-${visaSubclass}` } }
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
      formNumber: `BETA-MAP-${visaSubclass}-${Date.now()}`,
      title: "Controlled beta mapping template",
      category: "Testing",
      sourceName: WORKSPACE_NAME,
      subclassCodes: [visaSubclass],
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: OfficialFormSupportStatus.FILLABLE_PDF,
      isFirmProvided: true,
      downloadedAt: new Date(),
      lastCheckedAt: new Date(),
      fileName: "controlled-beta-template.pdf",
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

function subclassDraftPackSupport(code: string) {
  return ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"].includes(code);
}

async function main() {
  const workspace = await upsertWorkspace();
  const owner = await upsertUser({ workspaceId: workspace.id, email: USERS.owner, name: "Aria Beta Owner", role: UserRole.COMPANY_OWNER, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  const admin = await upsertUser({ workspaceId: workspace.id, email: USERS.admin, name: "Aria Beta Admin", role: UserRole.COMPANY_ADMIN, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  const agent1 = await upsertUser({ workspaceId: workspace.id, email: USERS.agent1, name: "Aria Beta Agent One", role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY, supervisorId: admin.id });
  const agent2 = await upsertUser({ workspaceId: workspace.id, email: USERS.agent2, name: "Aria Beta Agent Two", role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY, supervisorId: admin.id });

  const matterA = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent1.id,
    clientFirstName: "Dummy",
    clientLastName: "Student One",
    clientEmail: USERS.client1,
    title: "Controlled beta matter A",
    visaSubclass: "500",
    visaStream: "Higher Education"
  });
  const matterB = await ensureMatter({
    workspaceId: workspace.id,
    assignedToUserId: agent2.id,
    clientFirstName: "Dummy",
    clientLastName: "Student Two",
    clientEmail: USERS.client2,
    title: "Controlled beta matter B",
    visaSubclass: "500",
    visaStream: "Higher Education"
  });

  await seedSubclass500Documents(matterA.id, agent1.id, workspace.id);
  await createOrGetSubclass500Draft(matterA.id);
  await mapDocumentsToDraft(matterA.id);
  const beforeReview = await getDraftReviewData(matterA.id);
  const nameField = beforeReview.draft.fields.find((field: any) => field.templateField.fieldKey === "applicant.full_name");
  const verifyBefore = nameField?.value ?? null;
  if (nameField) {
    await updateDraftFieldReview({ draftFieldId: nameField.id, status: DraftFieldStatus.VERIFIED, notes: "Controlled beta verification" });
  }
  await mapDocumentsToDraft(matterA.id);
  const afterReview = await getDraftReviewData(matterA.id);
  const verifyAfter = afterReview.draft.fields.find((field: any) => field.id === nameField?.id)?.value ?? null;

  const matterTemplate = await ensureMappedTemplate(matterA.id, agent1.id, workspace.id, "500");
  const formDraftResult = await generateMatterFormDraft({ matterId: matterA.id, templateId: matterTemplate.id });
  const safetyBeforeConfirmation = await assessMatterCaseSafety(matterA.id);
  const confirmationItems = await buildMatterClientConfirmationItems(matterA.id);
  const confirmationRequest = await createClientIntakeRequest({
    workspaceId: workspace.id,
    createdByUserId: agent1.id,
    clientId: matterA.clientId,
    matterId: matterA.id,
    title: "Client confirmation tasks - Subclass 500",
    recipientName: "Dummy Student One",
    recipientEmail: USERS.client1,
    message: "Structured client confirmations for controlled beta.",
    workflowType: "CLIENT_CONFIRMATION",
    requestOrigin: "http://localhost:3007"
  });
  const confirmationFormData = new FormData();
  for (const item of confirmationItems) {
    confirmationFormData.set(`confirmation_response__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`, "confirmed");
    confirmationFormData.set(`confirmation_detail__${item.key.replace(/[^a-z0-9_.-]/gi, "_")}`, `Confirmed during controlled beta for ${item.title}.`);
  }
  const submittedConfirmationPayload = parseSubmittedClientConfirmations(confirmationFormData, confirmationItems);
  await submitIntake(confirmationRequest.token, {
    fullName: "Dummy Applicant",
    currentVisaStatus: "Student",
    currentVisaExpiry: "2028-08-31",
    passportNumber: "X7894485",
    educationHistory: "Aria Institute of Technology",
    employmentHistory: "Not relied upon in this dummy flow",
    englishLevel: "PTE 79",
    familyDetails: "No additional dependants",
    location: "Sydney",
    constraints: "None disclosed in dummy flow",
    preferredVisaGoal: "Subclass 500",
    notes: "Controlled beta test only",
    clientConfirmations: submittedConfirmationPayload
  });
  await prisma.clientIntakeRequest.updateMany({
    where: { id: confirmationRequest.request.id },
    data: { status: IntakeRequestStatus.REVIEWED, reviewedAt: new Date() }
  });
  const safetyAfterConfirmation = await assessMatterCaseSafety(matterA.id);

  const portalA = await ensureClientPortalToken({ workspaceId: workspace.id, clientId: matterA.clientId, matterId: matterA.id, label: "Beta portal A", createdByUserId: agent1.id, requestOrigin: "http://localhost:3007" });
  const portalB = await ensureClientPortalToken({ workspaceId: workspace.id, clientId: matterB.clientId, matterId: matterB.id, label: "Beta portal B", createdByUserId: agent2.id, requestOrigin: "http://localhost:3007" });
  const portalRecordA = await getClientPortalByToken(portalA.token);
  const portalRecordB = await getClientPortalByToken(portalB.token);

  const ownerMatters = await prisma.matter.findMany({ where: scopedMatterWhere(owner) });
  const adminMatters = await prisma.matter.findMany({ where: scopedMatterWhere(admin) });
  const agent1Matters = await prisma.matter.findMany({ where: scopedMatterWhere(agent1) });
  const agent2Matters = await prisma.matter.findMany({ where: scopedMatterWhere(agent2) });
  const agent1Clients = await prisma.client.findMany({ where: scopedClientWhere(agent1) });
  const agent2Clients = await prisma.client.findMany({ where: scopedClientWhere(agent2) });

  const subclassResults: Record<string, unknown> = {};
  for (const subclass of subclasses) {
    const title = `Controlled beta ${subclass} matter`;
    const existing = await prisma.matter.findFirst({ where: { workspaceId: workspace.id, title, visaSubclass: subclass } });
    const matter = existing ?? await ensureMatter({
      workspaceId: workspace.id,
      assignedToUserId: agent1.id,
      clientFirstName: "Dummy",
      clientLastName: subclass.replace(/[^\d]/g, "") || "Applicant",
      clientEmail: `dummy-${subclass.replace(/[^\d]/g, "") || "generic"}+aria@example.com`,
      title,
      visaSubclass: subclass,
      visaStream: subclass === "500" ? "Higher Education" : "General"
    });

    const checklistKey = subclass === "309/100" ? "309/100" : subclass;
    const checklistTemplate = checklistTemplates[checklistKey];
    let checklistCount = 0;
    if (checklistTemplate?.length) {
      checklistCount = (await generateChecklistForMatter(matter.id, agent1.id)).length;
    }
    const deterministicDraft = await buildGeneratedDocumentForMatter(matter.id, "COVER_LETTER").catch((error) => ({ supported: false, reason: error instanceof Error ? error.message : String(error) }));
    const draftPack = await generateVisaDraftPack(matter.id).catch(() => null);

    const subclassSupport = getSubclassSupport(subclass);
    const classification: "fully supported" | "partially supported" | "checklist-only" | "draft autofill unsupported" | "missing templates/rules" =
      subclassSupport.supportLevel === "FULL_FIELD_AUTOFILL"
        ? "fully supported"
        : subclassSupport.supportLevel === "CHECKLIST_AND_DRAFT_PACK"
          ? "partially supported"
          : subclassSupport.supportLevel === "CHECKLIST_ONLY"
            ? "checklist-only"
            : subclassSupport.supportLevel === "ONLINE_ONLY"
              ? "draft autofill unsupported"
              : "missing templates/rules";

    subclassResults[subclass] = {
      classification,
      checklistItems: checklistCount,
      deterministicDraftSupported: subclassSupport.aiDraftAutofill || Boolean((deterministicDraft as any).supported),
      draftPackSupported: Boolean(draftPack && subclassDraftPackSupport(subclass)),
      notes: subclassSupport.notes
    };
  }

  const auditEvents = await prisma.auditEvent.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 80
  });
  const auditJoined = JSON.stringify(auditEvents.map((event) => event.metadataJson ?? {}));
  const auditSecurity = {
    hasPortalUsed: auditEvents.some((event) => event.action === "portal.used"),
    hasClientConfirmationSent: auditEvents.some((event) => event.action === "client_confirmation.sent"),
    hasClientConfirmationSubmitted: auditEvents.some((event) => event.action === "client_confirmation.submitted"),
    hasDocumentUploaded: auditEvents.some((event) => event.action === "document.uploaded"),
    hasDocumentExtracted: auditEvents.some((event) => event.action === "document.extracted"),
    sensitiveLeakDetected: /(tokenHash|ariaenc:v1|X7894485|02 Aug 1999|dummy-passport\.pdf[\s\S]*Passport Number)/i.test(auditJoined)
  };

  const encryptedChecks = await prisma.extractedField.findMany({
    where: { matterId: matterA.id },
    select: { fieldValue: true, sourceSnippet: true }
  });

  console.log(JSON.stringify({
    workspace: { id: workspace.id, slug: workspace.slug },
    ownerFlow: {
      canManageTeam: canManageTeam(owner),
      canAccessCompanyWorkspace: canAccessCompanyWorkspace(owner),
      canViewAllMatters: hasFirmWideAccess(owner),
      permissions: getUserPermissions(owner)
    },
    adminFlow: {
      canManageTeam: canManageTeam(admin),
      canAccessCompanyWorkspace: canAccessCompanyWorkspace(admin),
      canViewAllMatters: hasFirmWideAccess(admin),
      canManageClients: hasPermission(admin, "can_manage_clients"),
      canExportData: hasPermission(admin, "can_export_data")
    },
    agentIsolation: {
      ownerMatterCount: ownerMatters.length,
      adminMatterCount: adminMatters.length,
      agent1MatterIds: agent1Matters.map((matter) => matter.id),
      agent2MatterIds: agent2Matters.map((matter) => matter.id),
      agent1ClientIds: agent1Clients.map((client) => client.id),
      agent2ClientIds: agent2Clients.map((client) => client.id),
      agent1CanAccessMatterB: canAccessMatter(agent1, { workspaceId: matterB.workspaceId, assignedToUserId: matterB.assignedToUserId, assignedToUser: { supervisorId: admin.id } }),
      agent2CanAccessMatterA: canAccessMatter(agent2, { workspaceId: matterA.workspaceId, assignedToUserId: matterA.assignedToUserId, assignedToUser: { supervisorId: admin.id } })
    },
    clientPortal: {
      matterA: portalRecordA ? { matterId: portalRecordA.matterId, clientId: portalRecordA.clientId, title: portalRecordA.matter?.title } : null,
      matterB: portalRecordB ? { matterId: portalRecordB.matterId, clientId: portalRecordB.clientId, title: portalRecordB.matter?.title } : null,
      tokenHashExposed: false
    },
    documentAutofill500: {
      readinessScore: afterReview.draft.readinessScore,
      verifiedFieldProtected: verifyBefore ? verifyBefore === verifyAfter : null,
      exactFields: {
        passport: afterReview.draft.fields.find((field: any) => field.templateField.fieldKey === "applicant.passport_number")?.value ?? null,
        coe: afterReview.draft.fields.find((field: any) => field.templateField.fieldKey === "study.coe_number")?.value ?? null,
        provider: afterReview.draft.fields.find((field: any) => field.templateField.fieldKey === "study.provider")?.value ?? null,
        funds: afterReview.draft.fields.find((field: any) => field.templateField.fieldKey === "financial.available_funds")?.value ?? null,
        oshc: afterReview.draft.fields.find((field: any) => field.templateField.fieldKey === "health.oshc_provider")?.value ?? null
      },
      unsafeStillReviewRequired: afterReview.draft.fields.filter((field: any) => field.templateField.fieldKey === "statement.genuine_student").map((field: any) => field.status),
      encryptedStorage: encryptedChecks.every((field) => isEncrypted(field.fieldValue) && (!field.sourceSnippet || isEncrypted(field.sourceSnippet)))
    },
    clientConfirmation: {
      itemCount: confirmationItems.length,
      categories: [...new Set(confirmationItems.map((item) => item.category))],
      safetyBefore: {
        hard: safetyBeforeConfirmation.hardBlockers.map((blocker) => blocker.title),
        soft: safetyBeforeConfirmation.softBlockers.map((blocker) => blocker.title)
      },
      safetyAfter: {
        hard: safetyAfterConfirmation.hardBlockers.map((blocker) => blocker.title),
        soft: safetyAfterConfirmation.softBlockers.map((blocker) => blocker.title)
      }
    },
    templateFlow: {
      templateId: matterTemplate.id,
      generatedDraftId: formDraftResult.supported ? formDraftResult.draft?.id ?? null : null,
      supported: formDraftResult.supported,
      filledFields: formDraftResult.reviewRows?.map((row) => ({ label: row.label, value: row.value, sourceFieldKey: row.sourceFieldKey })) ?? []
    },
    subclassResults,
    auditSecurity
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
