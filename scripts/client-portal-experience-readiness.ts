import { ExtractionStatus, MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import {
  createAppointment,
  createPortalAcknowledgement,
  createPortalMessage,
  ensureClientPortalToken,
  generateChecklistForMatter,
  getClientPortalByToken
} from "@/lib/services/client-workflows";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

const WORKSPACE_SLUG = "aria-client-portal-experience-readiness";

async function upsertWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Aria Client Portal Experience Readiness", plan: WorkspacePlan.PRO },
    create: { name: "Aria Client Portal Experience Readiness", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO }
  });
}

async function upsertUser(workspaceId: string) {
  return prisma.user.upsert({
    where: { email: "portal-readiness-agent@example.com" },
    update: {
      workspaceId,
      name: "Portal Readiness Agent",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId,
      name: "Portal Readiness Agent",
      email: "portal-readiness-agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });
}

async function ensureClientAndMatter(workspaceId: string, assignedToUserId: string) {
  const client = await prisma.client.upsert({
    where: { clientReference: "PORTAL-READINESS-CLIENT" },
    update: {
      workspaceId,
      firstName: "Portal",
      lastName: "Readiness",
      email: "portal-readiness-client@example.com",
      phone: "0400000000",
      assignedToUserId
    },
    create: {
      workspaceId,
      clientReference: "PORTAL-READINESS-CLIENT",
      firstName: "Portal",
      lastName: "Readiness",
      dob: new Date("1999-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "portal-readiness-client@example.com",
      phone: "0400000000",
      assignedToUserId
    }
  });

  const existingMatter = await prisma.matter.findFirst({
    where: { workspaceId, title: "Portal Readiness Matter" }
  });
  const matter = existingMatter ?? await prisma.matter.create({
    data: {
      workspaceId,
      clientId: client.id,
      assignedToUserId,
      title: "Portal Readiness Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 35
    }
  });

  await generateChecklistForMatter(matter.id, assignedToUserId);
  const firstChecklistItem = await prisma.checklistItem.findFirstOrThrow({
    where: { matterId: matter.id },
    orderBy: { label: "asc" }
  });
  await prisma.checklistItem.update({
    where: { id: firstChecklistItem.id },
    data: { requestedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
  });

  const secondChecklistItem = await prisma.checklistItem.findFirst({
    where: { matterId: matter.id, id: { not: firstChecklistItem.id } },
    orderBy: { label: "asc" }
  });
  if (secondChecklistItem) {
    const flaggedDocument = await prisma.document.create({
      data: {
        workspaceId,
        clientId: client.id,
        matterId: matter.id,
        uploadedByUserId: assignedToUserId,
        fileName: "DEMO DOCUMENT - NOT REAL CLIENT DATA - blurry bank statement.pdf",
        storageKey: `demo/portal-readiness/${matter.id}/blurry-bank-statement.pdf`,
        mimeType: "application/pdf",
        fileSize: 1024,
        category: secondChecklistItem.category,
        extractionStatus: ExtractionStatus.NEEDS_REVIEW,
        reviewStatus: ReviewStatus.FLAGGED
      }
    });
    await prisma.checklistItem.update({
      where: { id: secondChecklistItem.id },
      data: { documentId: flaggedDocument.id, status: "REUPLOAD_REQUESTED", requestedAt: new Date(), dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) }
    });
  }

  return { client, matter };
}

function assertNoSensitivePayload(payload: unknown) {
  const text = JSON.stringify(payload);
  return !/tokenHash|storageKey|metadataJson|sourceSnippet|rawDocumentUrl|signedUrl|publicUrl/i.test(text);
}

async function main() {
  const checks: Check[] = [];
  const workspace = await upsertWorkspace();
  const agent = await upsertUser(workspace.id);
  const { client, matter } = await ensureClientAndMatter(workspace.id, agent.id);
  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Client portal readiness token",
    createdByUserId: agent.id,
    requestOrigin: "https://aria.test"
  });

  const portalView = await getClientPortalByToken(portal.token);
  checks.push({
    name: "Portal token opens only its scoped matter",
    pass: portalView?.matterId === matter.id && portalView?.clientId === client.id
  });
  checks.push({
    name: "Portal payload excludes tokenHash/storageKey/raw URL/source snippets",
    pass: assertNoSensitivePayload(portalView)
  });
  checks.push({
    name: "Portal checklist exposes required document statuses",
    pass: Boolean(portalView?.matter?.checklistItems.length && portalView.matter.checklistItems.every((item) => item.label && item.category && typeof item.required === "boolean"))
  });
  checks.push({
    name: "Portal shows assigned agent safe contact metadata",
    pass: portalView?.matter?.assignedToUser.email === agent.email && assertNoSensitivePayload(portalView.matter.assignedToUser)
  });

  await createPortalMessage({ token: portal.token, message: "Dummy client message for readiness check. No real client data." });
  const messageEvent = await prisma.matterTimelineEvent.findFirst({
    where: { matterId: matter.id, eventType: "portal.client_message" },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Matter-scoped portal message records timeline event",
    pass: Boolean(messageEvent?.description?.includes("Dummy client message"))
  });
  const messageAudit = await prisma.auditEvent.findFirst({
    where: { workspaceId: workspace.id, entityId: matter.id, action: "portal.message.created" },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Portal message audit avoids raw message body",
    pass: Boolean(messageAudit) && !JSON.stringify(messageAudit?.metadataJson).includes("Dummy client message")
  });

  await createPortalAcknowledgement({ token: portal.token, acknowledgementType: "Portal readiness acknowledgement" });
  const ackEvent = await prisma.matterTimelineEvent.findFirst({
    where: { matterId: matter.id, eventType: "portal.client_acknowledgement" },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Client acknowledgement/confirmation records review-required wording",
    pass: Boolean(ackEvent?.description?.includes("Registered migration agent review required"))
  });

  await createAppointment({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    assignedToUserId: agent.id,
    requestedByName: "Portal Readiness",
    requestedByEmail: "portal-readiness-client@example.com",
    meetingType: "Readiness consultation",
    startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    notes: "Dummy appointment note"
  });
  const appointmentEvent = await prisma.matterTimelineEvent.findFirst({
    where: { matterId: matter.id, eventType: "appointment.requested" },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Client appointment request is matter-scoped and audited",
    pass: Boolean(appointmentEvent)
  });

  const invalidPortal = await getClientPortalByToken(`${portal.token}-invalid`);
  checks.push({
    name: "Invalid portal token fails cleanly",
    pass: invalidPortal === null
  });

  const portalPage = readFileSync("app/client/portal/[token]/page.tsx", "utf8");
  const documentsPage = readFileSync("app/client/documents/[token]/page.tsx", "utf8");
  const checklistPage = readFileSync("app/client/checklist/[token]/page.tsx", "utf8");
  const portalSource = [portalPage, documentsPage, checklistPage].join("\n");
  checks.push({
    name: "Portal pages do not use ready-to-lodge wording",
    pass: !/ready to lodge/i.test(portalSource)
  });
  checks.push({
    name: "Portal pages do not render raw token hashes",
    pass: !/tokenHash/.test(portalSource)
  });
  checks.push({
    name: "Portal home includes next-action dashboard and secure message thread",
    pass: /What you need to do next/.test(portalPage) && /Message your migration team/.test(portalPage)
  });
  checks.push({
    name: "Documents page uses styled upload component instead of visible default file input",
    pass: /PortalUploadForm/.test(documentsPage) && /Browse files/.test(readFileSync("components/client-portal/portal-upload-form.tsx", "utf8"))
  });
  checks.push({
    name: "Appointment booking supports no-live-availability fallback",
    pass: /No live availability is configured yet/.test(readFileSync("app/client/book/[token]/page.tsx", "utf8")) && /preferredWindow/.test(readFileSync("app/client/book/[token]/page.tsx", "utf8"))
  });

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({
    pass: failed.length === 0,
    workspace: workspace.slug,
    matterId: matter.id,
    checks,
    failed: failed.map((check) => check.name)
  }, null, 2));
  if (failed.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
