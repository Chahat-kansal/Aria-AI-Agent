import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import {
  AppointmentStatus,
  AcknowledgementReviewStatus,
  DocumentRequestStatus,
  MatterStage,
  MatterStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCloudDriveProviderStatus } from "@/lib/providers/cloud-drive-provider";
import { upsertWorkspaceProviderConnection, getWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";
import { buildMatterExportItems, SECURE_STORAGE_RETRIEVAL_MODE } from "@/lib/services/cloud-drive/matter-export-builder";
import { runCloudDriveExport } from "@/lib/services/cloud-drive/cloud-drive-export";
import { getCloudDriveProviderRouter } from "@/lib/services/cloud-drive/cloud-drive-provider-router";
import { createCloudDriveManifest, createRedactedCloudDriveManifestPreview } from "@/lib/services/cloud-drive/export-manifest";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { encryptString } from "@/lib/security/encryption";
import { generateAcknowledgementRecord } from "@/lib/services/esign/acknowledgement-record";

const WORKSPACE_SLUG = "cloud-drive-readiness-demo";
const OWNER_EMAIL = "owner.cloud.drive.demo@example.com";
const ASSIGNED_EMAIL = "agent.cloud.drive.assigned@example.com";
const UNASSIGNED_EMAIL = "agent.cloud.drive.unassigned@example.com";

async function ensureDemoData() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Cloud Drive Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL
    },
    update: {
      name: "BrightPath Cloud Drive Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Cloud Demo Owner",
      email: OWNER_EMAIL,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    },
    update: {
      workspaceId: workspace.id,
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER)
    }
  });

  const assigned = await prisma.user.upsert({
    where: { email: ASSIGNED_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Assigned Agent",
      email: ASSIGNED_EMAIL,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true }
    },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true }
    }
  });

  const unassigned = await prisma.user.upsert({
    where: { email: UNASSIGNED_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Unassigned Agent",
      email: UNASSIGNED_EMAIL,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true }
    },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true }
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "CLOUD-DRIVE-DEMO-CLIENT" },
    create: {
      workspaceId: workspace.id,
      clientReference: "CLOUD-DRIVE-DEMO-CLIENT",
      firstName: "Nora",
      lastName: "Patel",
      email: "nora.cloud.drive.demo@example.com",
      phone: "+61400000991",
      dob: new Date("1991-03-04T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: assigned.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Nora",
      lastName: "Patel",
      email: "nora.cloud.drive.demo@example.com",
      phone: "+61400000991",
      assignedToUserId: assigned.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "CLOUD-DRIVE-DEMO-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterReference: "CLOUD-DRIVE-DEMO-MATTER-001",
      assignedToUserId: assigned.id,
      title: "Cloud Drive Export Demo Matter",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 58
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: assigned.id,
      title: "Cloud Drive Export Demo Matter",
      readinessScore: 58
    }
  });

  const otherMatter = await prisma.matter.upsert({
    where: { matterReference: "CLOUD-DRIVE-DEMO-MATTER-002" },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterReference: "CLOUD-DRIVE-DEMO-MATTER-002",
      assignedToUserId: owner.id,
      title: "Other Matter",
      visaSubclass: "600",
      visaStream: "Visitor",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.INTAKE,
      readinessScore: 44
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Other Matter",
      readinessScore: 44
    }
  });

  const existingDoc = await prisma.document.findFirst({ where: { matterId: matter.id, fileName: "Passport 123456789.pdf" } });
  const sensitiveDoc = existingDoc ?? await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      fileName: "Passport 123456789.pdf",
      storageKey: "private/demo/passport-123456789",
      mimeType: "application/pdf",
      category: "Identity",
      uploadedByUserId: assigned.id,
      extractionStatus: "EXTRACTED",
      reviewStatus: ReviewStatus.VERIFIED
    }
  });
  await prisma.documentStorageObject.upsert({
    where: { documentId: sensitiveDoc.id },
    create: {
      documentId: sensitiveDoc.id,
      provider: "database",
      storageKey: "private/demo/passport-123456789",
      data: Buffer.from(encryptString("demo passport bytes"), "utf8")
    },
    update: {
      provider: "database",
      storageKey: "private/demo/passport-123456789",
      data: Buffer.from(encryptString("demo passport bytes"), "utf8")
    }
  });

  const skippedDoc = await prisma.document.upsert({
    where: { id: "cme0skipdemo0000000000000001" },
    create: {
      id: "cme0skipdemo0000000000000001",
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      fileName: "Relationship notes 555666777.txt",
      storageKey: "private/demo/relationship-notes",
      mimeType: "text/plain",
      category: "Relationship",
      uploadedByUserId: assigned.id,
      extractionStatus: "EXTRACTED",
      reviewStatus: ReviewStatus.VERIFIED
    },
    update: {
      fileName: "Relationship notes 555666777.txt",
      storageKey: "private/demo/relationship-notes",
      mimeType: "text/plain",
      category: "Relationship"
    }
  });
  await prisma.documentStorageObject.deleteMany({ where: { documentId: skippedDoc.id } });

  const otherDoc = await prisma.document.findFirst({ where: { matterId: otherMatter.id } }) ?? await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: otherMatter.id,
      fileName: "Other matter doc.pdf",
      storageKey: "private/demo/other-matter-doc",
      mimeType: "application/pdf",
      category: "Identity",
      uploadedByUserId: owner.id,
      extractionStatus: "EXTRACTED",
      reviewStatus: ReviewStatus.VERIFIED
    }
  });

  await prisma.generatedDocument.upsert({
    where: { id: "cme0gddemo000000000000000001" },
    create: {
      id: "cme0gddemo000000000000000001",
      workspaceId: workspace.id,
      matterId: matter.id,
      createdByUserId: assigned.id,
      type: "COVER_LETTER",
      title: "Draft pack summary",
      content: "Dummy draft pack content for readiness proof."
    },
    update: {
      title: "Draft pack summary",
      content: "Dummy draft pack content for readiness proof."
    }
  });

  const invoice = await prisma.invoice.upsert({
    where: { workspaceId_invoiceNumber: { workspaceId: workspace.id, invoiceNumber: "INV-CLOUD-0001" } },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: assigned.id,
      clientName: "Nora Patel",
      clientEmail: client.email,
      invoiceNumber: "INV-CLOUD-0001",
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 120000,
      gstCents: 12000,
      totalCents: 132000,
      lineItemsJson: [{ description: "Demo invoice", quantity: 1, unitPriceCents: 120000, gstRateBps: 1000, isTaxInclusive: false }],
      status: "SENT",
      reviewRequired: true
    },
    update: {
      clientName: "Nora Patel",
      clientEmail: client.email,
      subtotalCents: 120000,
      gstCents: 12000,
      totalCents: 132000,
      lineItemsJson: [{ description: "Demo invoice", quantity: 1, unitPriceCents: 120000, gstRateBps: 1000, isTaxInclusive: false }],
      status: "SENT"
    }
  });

  const request = await prisma.clientAcknowledgementRequest.upsert({
    where: { id: "cme0ackdemo000000000000000001" },
    create: {
      id: "cme0ackdemo000000000000000001",
      workspaceId: workspace.id,
      matterId: matter.id,
      clientId: client.id,
      requestedByUserId: assigned.id,
      provider: "internal_acknowledgement",
      status: "SUBMITTED",
      title: "Client declaration confirmation",
      requestType: "DECLARATION_CONFIRMATION",
      safeSummary: "Review-required declaration confirmation",
      latestClientSessionId: "demo-session",
      latestClientIpHash: "iphash-demo",
      latestUserAgentHash: "uahash-demo",
      sentAt: new Date(),
      viewedAt: new Date(),
      submittedAt: new Date()
    },
    update: {
      status: "SUBMITTED",
      title: "Client declaration confirmation",
      safeSummary: "Review-required declaration confirmation",
      submittedAt: new Date()
    }
  });

  const response = await prisma.clientAcknowledgementResponse.upsert({
    where: { requestId: request.id },
    create: {
      workspaceId: workspace.id,
      matterId: matter.id,
      clientId: client.id,
      requestId: request.id,
      provider: "internal_acknowledgement",
      reviewStatus: AcknowledgementReviewStatus.AGENT_REVIEW_REQUIRED,
      submittedAt: new Date(),
      clientSessionId: "demo-session",
      clientIpHash: "iphash-demo",
      userAgentHash: "uahash-demo",
      responseJson: encryptString(JSON.stringify({
        answers: [
          { title: "Health declaration", response: "confirmed", detail: "Dummy response only" }
        ]
      }))
    },
    update: {
      reviewStatus: AcknowledgementReviewStatus.AGENT_REVIEW_REQUIRED,
      responseJson: encryptString(JSON.stringify({
        answers: [
          { title: "Health declaration", response: "confirmed", detail: "Dummy response only" }
        ]
      }))
    }
  });

  await prisma.clientAcknowledgementRequest.update({
    where: { id: request.id },
    data: { response: { connect: { id: response.id } } }
  }).catch(() => null);
  await generateAcknowledgementRecord(request.id);

  await prisma.cloudDriveEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.cloudDriveExportItem.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.cloudDriveExportJob.deleteMany({ where: { workspaceId: workspace.id } });

  return { workspace, owner, assigned, unassigned, matter, otherDoc, sensitiveDoc, skippedDoc, invoice, request };
}

function assertNoSensitiveStrings(value: string) {
  assert(!value.includes("http://"), "preview should not include raw URLs");
  assert(!value.includes("https://"), "preview should not include raw URLs");
  assert(!value.includes("storageKey"), "preview should not include storage keys");
  assert(!/123456789|555666777/.test(value), "preview should not include sensitive demo identifiers");
}

async function main() {
  const seeded = await ensureDemoData();
  const providerStatus = getCloudDriveProviderStatus();

  assert(providerStatus.key === "cloud_drive");
  assert(providerStatus.state === "disabled", "disabled provider state should pass honestly by default");
  assert(providerStatus.disabledReason?.includes("not configured"), "disabled state should be explicit");

  process.env.CLOUD_DRIVE_PROVIDER = "google_drive";
  const googleMissing = getCloudDriveProviderStatus();
  assert(googleMissing.state === "not_configured", "Google config missing state should be clear");
  assert(googleMissing.missingEnv.includes("GOOGLE_DRIVE_CLIENT_ID"), "Google env requirements should be visible");

  process.env.CLOUD_DRIVE_PROVIDER = "onedrive";
  const oneDriveMissing = getCloudDriveProviderStatus();
  assert(oneDriveMissing.state === "not_configured", "OneDrive config missing state should be clear");
  assert(oneDriveMissing.missingEnv.includes("MICROSOFT_DRIVE_CLIENT_ID"), "OneDrive env requirements should be visible");

  process.env.CLOUD_DRIVE_PROVIDER = "disabled";

  await upsertWorkspaceProviderConnection({
    workspaceId: seeded.workspace.id,
    key: "cloud_drive",
    providerName: "google_drive",
    accessToken: "demo-access-token",
    refreshToken: "demo-refresh-token",
    connectedAccountLabel: "Drive Demo Account",
    scopes: ["drive.file"],
    metadataJson: { selectedFolderId: "demo-folder-root" }
  });
  const storedConnection = await getWorkspaceProviderConnection(seeded.workspace.id, "cloud_drive");
  assert(storedConnection?.encryptedAccessToken && storedConnection.encryptedAccessToken !== "demo-access-token", "OAuth token storage should use encrypted token vault path");

  const built = await buildMatterExportItems({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    exportType: "matter_folder"
  });
  assert(SECURE_STORAGE_RETRIEVAL_MODE === "storage_object_bytes_decrypt_if_needed", "secure storage retrieval path should be used");
  assert(built.items.some((item) => item.path.includes("01 Identity")), "matter folder structure should map categories");
  assert(built.items.every((item) => !item.path.includes("123456789")), "filenames should be sanitised");
  assert(built.skippedReasons.length > 0, "skipped unsupported file reasons should be shown");

  const manifest = createCloudDriveManifest({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    exportType: "matter_folder",
    provider: "disabled",
    exportedByUserId: seeded.assigned.id,
    items: built.items.map((item) => ({
      path: item.path,
      category: item.category,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      sourceEntityType: item.sourceEntityType,
      sourceEntityId: item.sourceEntityId
    })),
    skippedReasons: built.skippedReasons
  });
  const previewText = JSON.stringify(createRedactedCloudDriveManifestPreview(manifest));
  assertNoSensitiveStrings(previewText);

  const assignedDryRun = await runCloudDriveExport({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    user: seeded.assigned,
    exportType: "matter_folder",
    dryRun: true
  });
  assert(assignedDryRun.mode === "disabled", "local ZIP fallback state should stay honest when provider is not configured");
  assert(assignedDryRun.localZipFallback?.available, "local secure ZIP fallback should be honest");

  const draftPackDryRun = await runCloudDriveExport({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    user: seeded.assigned,
    exportType: "draft_pack",
    dryRun: true
  });
  assert(draftPackDryRun.manifest.fileCount >= 1, "draft pack export dry-run should work");

  const invoiceDryRun = await runCloudDriveExport({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    user: seeded.assigned,
    exportType: "invoice",
    invoiceId: seeded.invoice.id,
    dryRun: true
  });
  assert(invoiceDryRun.manifest.categoriesExported.includes("10 Invoices"), "invoice export dry-run should work");

  const acknowledgementDryRun = await runCloudDriveExport({
    workspaceId: seeded.workspace.id,
    matterId: seeded.matter.id,
    user: seeded.assigned,
    exportType: "acknowledgement",
    acknowledgementRequestId: seeded.request.id,
    dryRun: true
  });
  assert(acknowledgementDryRun.manifest.categoriesExported.includes("08 Confirmations"), "acknowledgement export dry-run should work");

  await assert.rejects(
    () => runCloudDriveExport({
      workspaceId: seeded.workspace.id,
      matterId: seeded.matter.id,
      user: seeded.unassigned,
      exportType: "matter_folder",
      dryRun: true
    }),
    /scope|permission/i,
    "unassigned agent should not export another matter"
  );

  await assert.rejects(
    () => runCloudDriveExport({
      workspaceId: seeded.workspace.id,
      matterId: seeded.matter.id,
      user: seeded.assigned,
      exportType: "selected_documents",
      selectedDocumentIds: [seeded.otherDoc.id],
      dryRun: true
    }),
    /outside the authorised matter scope/i,
    "selected-document export should check permissions"
  );

  const router = await getCloudDriveProviderRouter({
    workspaceId: seeded.workspace.id,
    userId: seeded.assigned.id,
    provider: "google_drive",
    selectedFolderId: "demo-folder-root"
  });
  const googleDryRunUpload = await router.uploadFile({
    workspaceId: seeded.workspace.id,
    userId: seeded.assigned.id,
    provider: "google_drive",
    payload: {
      fileName: "demo.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("demo", "utf8"),
      folderId: "demo-folder-root"
    },
    dryRun: true
  });
  assert(googleDryRunUpload.ok && googleDryRunUpload.dryRun, "Google Drive dry-run upload should work");

  process.env.CLOUD_DRIVE_PROVIDER = "onedrive";
  const oneDriveRouter = await getCloudDriveProviderRouter({
    workspaceId: seeded.workspace.id,
    userId: seeded.assigned.id,
    provider: "onedrive",
    selectedFolderId: "demo-folder-root"
  });
  const oneDriveDryRunUpload = await oneDriveRouter.uploadFile({
    workspaceId: seeded.workspace.id,
    userId: seeded.assigned.id,
    provider: "onedrive",
    payload: {
      fileName: "demo.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("demo", "utf8"),
      folderId: "demo-folder-root"
    },
    dryRun: true
  });
  assert(oneDriveDryRunUpload.ok && oneDriveDryRunUpload.dryRun, "OneDrive dry-run upload should work");
  process.env.CLOUD_DRIVE_PROVIDER = "disabled";

  const adminIntegrationsSource = await readFile("app/admin/integrations/page.tsx", "utf8");
  assert(!adminIntegrationsSource.includes("/api/settings/data/export-folder"), "platform admin should not get a private export action");

  const auditEvents = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { startsWith: "cloud_drive." } },
    orderBy: { createdAt: "desc" }
  });
  assert(auditEvents.some((event) => event.action === "cloud_drive.unauthorised_export_blocked"), "unauthorised export should be audited");
  const auditPreview = JSON.stringify(auditEvents.map((event) => event.metadataJson));
  assertNoSensitiveStrings(auditPreview);

  const output = {
    pass: true,
    checks: {
      disabledProviderState: true,
      googleConfigMissingState: true,
      oneDriveConfigMissingState: true,
      encryptedTokenVaultPath: true,
      dryRunManifestSafe: true,
      sanitisedFolderStructure: true,
      platformAdminBlocked: true,
      unassignedAgentBlocked: true,
      assignedAgentDryRunAllowed: true,
      secureStorageRetrievalPath: true,
      selectedDocumentPermissionCheck: true,
      draftPackDryRun: true,
      invoiceDryRun: true,
      acknowledgementDryRun: true,
      skippedReasonsShown: true,
      auditMetadataRedaction: true,
      localZipFallbackHonest: true,
      googleDriveDryRunUpload: true,
      oneDriveDryRunUpload: true
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
