import { PrismaClient, WorkspacePlan, UserRole, UserStatus, UserVisibilityScope, MatterStatus, MatterStage, OfficialFormLifecycleStatus, OfficialFormSupportStatus } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { ensureClientPortalToken, createClientIntakeRequest, createDocumentRequest, generateChecklistForMatter } from "../lib/services/client-workflows";
import { detectFillableFields, generateMatterFormDraft, approveMatterFormDraft, publishApprovedFormToClient } from "../lib/services/pdf-form-engine";
import { getOrCreateWorkspaceOperationalSettings } from "../lib/services/workspace-operational-settings";
import { encryptString } from "../lib/security/encryption";

const prisma = new PrismaClient();

async function main() {
  const suffix = `smoke-${Date.now()}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: `Aria Smoke ${suffix}`,
      slug: `aria-${suffix}`,
      plan: WorkspacePlan.STARTER,
      timezone: "Australia/Sydney"
    }
  });

  const owner = await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      name: `Owner ${suffix}`,
      email: `${suffix}@example.com`,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      hashedPassword: "not-used-in-smoke"
    }
  });

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      firstName: "Test",
      lastName: "Client",
      dob: new Date("1995-03-15"),
      nationality: "India",
      email: `${suffix}.client@example.com`,
      phone: "+610400000000",
      notes: encryptString("Dummy smoke-test notes"),
      assignedToUserId: owner.id
    }
  });

  const matter = await prisma.matter.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      title: "Subclass 500 Student Visa",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.AWAITING_DOCS,
      stage: MatterStage.EVIDENCE,
      assignedToUserId: owner.id,
      readinessScore: 32
    }
  });

  const settings = await getOrCreateWorkspaceOperationalSettings(workspace.id);
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId: workspace.id },
    data: {
      appointmentTypesJson: [{ key: "consultation", label: "Consultation", durationMinutes: 45 }],
      appointmentAvailabilityJson: [
        { weekday: 1, start: "09:00", end: "12:00" },
        { weekday: 3, start: "13:00", end: "16:00" }
      ],
      appointmentMeetingMethodsJson: ["video", "phone"]
    }
  });

  const checklist = await generateChecklistForMatter(matter.id, owner.id);
  const checklistIds = checklist.slice(0, 2).map((item) => item.id);

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Client portal",
    createdByUserId: owner.id,
    requestOrigin: "http://localhost:3007"
  });

  const intake = await createClientIntakeRequest({
    workspaceId: workspace.id,
    createdByUserId: owner.id,
    clientId: client.id,
    matterId: matter.id,
    title: "Complete your intake",
    recipientName: "Test Client",
    recipientEmail: client.email,
    requestOrigin: "http://localhost:3007"
  });

  const documentRequest = await createDocumentRequest({
    workspaceId: workspace.id,
    matterId: matter.id,
    clientId: client.id,
    createdByUserId: owner.id,
    checklistItemIds: checklistIds,
    recipientName: "Test Client",
    recipientEmail: client.email,
    requestOrigin: "http://localhost:3007"
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  form.createTextField("Client Full Name").addToPage(page, { x: 50, y: 700, width: 220, height: 20 });
  form.createTextField("email").addToPage(page, { x: 50, y: 660, width: 220, height: 20 });
  const pdfBytes = Buffer.from(await pdf.save());
  const inspected = await detectFillableFields(pdfBytes);

  const template = await prisma.officialFormTemplate.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      sourceType: "FIRM_TEMPLATE",
      formNumber: `FIRM-${suffix}`,
      title: "Dummy firm template",
      category: "Testing",
      sourceName: "Firm-provided",
      subclassCodes: ["500"],
      lifecycleStatus: OfficialFormLifecycleStatus.CURRENT,
      supportStatus: OfficialFormSupportStatus.FILLABLE_PDF,
      isFirmProvided: true,
      fileName: `firm-${suffix}.pdf`,
      mimeType: "application/pdf",
      fileData: pdfBytes,
      fieldSchemaJson: inspected.fields
    }
  });

  const draftResult = await generateMatterFormDraft({ matterId: matter.id, templateId: template.id });
  if (!draftResult.supported || !("draft" in draftResult) || !draftResult.draft) {
    throw new Error("Matter form draft generation did not succeed");
  }

  await approveMatterFormDraft(draftResult.draft.id, owner.id);
  await publishApprovedFormToClient(draftResult.draft.id);

  console.log(JSON.stringify({
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    ownerId: owner.id,
    clientId: client.id,
    matterId: matter.id,
    portalUrl: portal.url,
    portalToken: portal.token,
    intakeUrl: intake.url,
    intakeToken: intake.token,
    documentRequestUrl: documentRequest.url,
    documentRequestToken: documentRequest.token,
    formTemplateId: template.id,
    formDraftId: draftResult.draft.id,
    availableChecklistItems: checklist.length,
    settingsId: settings.id
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
