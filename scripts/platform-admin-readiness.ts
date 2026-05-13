import { ExtractionStatus, FieldStatus, MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "platform-admin-readiness+aria@example.com";
const OWNER_EMAIL = "owner-platform-admin-readiness+aria@example.com";
const AGENT_EMAIL = "agent-platform-admin-readiness+aria@example.com";
const WORKSPACE_SLUG = "platform-admin-readiness";

async function main() {
  process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
  const { isPlatformAdminEmail, auditPlatformAdminAction } = await import("@/lib/services/platform-admin");
  const { getWorkspaceRows, getAuditRows, safeJson } = await import("@/lib/services/platform-admin-data");
  const { encryptString } = await import("@/lib/security/encryption");

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Platform Admin Readiness Pty Ltd", plan: WorkspacePlan.PRO },
    create: { name: "Platform Admin Readiness Pty Ltd", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO }
  });
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER },
    create: { workspaceId: workspace.id, name: "Platform Readiness Admin", email: ADMIN_EMAIL, status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER }
  });
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER },
    create: { workspaceId: workspace.id, name: "Workspace Owner", email: OWNER_EMAIL, status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER }
  });
  const agent = await prisma.user.upsert({
    where: { email: AGENT_EMAIL },
    update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT },
    create: { workspaceId: workspace.id, name: "Workspace Agent", email: AGENT_EMAIL, status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT }
  });
  const client = await prisma.client.upsert({
    where: { clientReference: "platform-admin-readiness-client" },
    update: { notes: encryptString("Sensitive client notes must not appear in platform admin.") },
    create: {
      workspaceId: workspace.id,
      clientReference: "platform-admin-readiness-client",
      firstName: "Sensitive",
      lastName: "Client",
      dob: new Date("1990-01-01T00:00:00.000Z"),
      nationality: "Test",
      email: "sensitive-client@example.com",
      phone: "0400000000",
      notes: encryptString("Sensitive client notes must not appear in platform admin.")
    }
  });
  const matter = await prisma.matter.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Sensitive matter title should not be listed in platform admin",
      visaSubclass: "500",
      visaStream: "Test",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.INTAKE,
      readinessScore: 0
    }
  });
  const document = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      fileName: "sensitive-passport-file-name.pdf",
      storageKey: "redacted/storage/key",
      mimeType: "application/pdf",
      fileSize: 100,
      contentHash: "redacted-hash",
      category: "Identity",
      uploadedByUserId: agent.id,
      extractionStatus: ExtractionStatus.EXTRACTED,
      reviewStatus: ReviewStatus.PENDING
    }
  });
  await prisma.extractedField.create({
    data: {
      matterId: matter.id,
      documentId: document.id,
      fieldKey: "applicant.passport_number",
      fieldLabel: "Passport number",
      fieldValue: encryptString("X9999999"),
      confidence: 0.95,
      sourceSnippet: encryptString("Sensitive source snippet should not appear"),
      sourcePageRef: encryptString("page 1"),
      status: FieldStatus.NEEDS_REVIEW,
      needsReview: true
    }
  });

  await auditPlatformAdminAction(admin, "platform.readiness.test", {
    tokenHash: "raw-token-hash-should-redact",
    passportNumber: "X9999999",
    extractedText: "Sensitive extracted text should redact",
    safeCount: 1
  });

  const workspaces = await getWorkspaceRows();
  const audits = await getAuditRows({ workspaceId: workspace.id }, 20);
  const joined = safeJson({ workspaces, audits });
  const forbiddenPatterns = [/X9999999/, /Sensitive source snippet/, /Sensitive extracted text should redact/, /raw-token-hash-should-redact/];

  const result = {
    platformAdminAllowed: isPlatformAdminEmail(ADMIN_EMAIL),
    ownerDeniedUnlessAllowlisted: !isPlatformAdminEmail(OWNER_EMAIL),
    agentDeniedUnlessAllowlisted: !isPlatformAdminEmail(AGENT_EMAIL),
    workspaceMetadataVisible: workspaces.some((item) => item.id === workspace.id),
    extractedDocumentTextHidden: !forbiddenPatterns.some((pattern) => pattern.test(joined)),
    draftFieldValuesHidden: !/Sensitive matter title should not be listed/.test(joined),
    tokenHashHidden: !/raw-token-hash-should-redact/.test(joined),
    auditRecorded: audits.some((event) => event.action === "platform.readiness.test")
  };

  const pass = Object.values(result).every(Boolean);
  console.log(JSON.stringify({ pass, result }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());
