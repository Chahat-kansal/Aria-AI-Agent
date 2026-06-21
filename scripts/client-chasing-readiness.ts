import fs from "node:fs";
import path from "node:path";
import { hash } from "bcryptjs";
import {
  AppointmentStatus,
  ClientChaseStatus,
  DocumentRequestItemStatus,
  DocumentRequestStatus,
  DraftStatus,
  InvoiceStatus,
  MatterStage,
  MatterStatus,
  ReviewRequestStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceRows, safeJson } from "@/lib/services/platform-admin-data";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import {
  getClientChasingDashboard,
  previewClientChase,
  runClientChasingScheduler,
  saveClientChasingSettings,
  sendClientChase,
  upsertClientChasingPreference,
  type ScopedUser
} from "@/lib/services/chasing/client-chasing-service";
import { getClientChasingSettingsView } from "@/lib/services/chasing/client-chasing-policy";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const ROOT = process.cwd();
const WORKSPACE_SLUG = "client-chasing-readiness";
const OWNER_EMAIL = "chasing.owner@example.com";
const OWNER_PASSWORD = "Chasing-Owner-2026!";

function assertSafeCopy(value: string) {
  return !/(passport|date of birth|\bdob\b|grant number|\btrn\b|health|character|financial details|tokenhash|raw portal token|storage key)/i.test(value);
}

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Client Chasing Readiness", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    create: { slug: WORKSPACE_SLUG, name: "Client Chasing Readiness", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      name: "Chasing Owner",
      email: OWNER_EMAIL,
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      clientChasingEnabled: false,
      clientChasingAutoSendEnabled: false,
      clientChasingConsentRequired: true,
      clientChasingFrequencyHours: 48,
      clientChasingChannelsJson: { portal: true, email: true, sms: false, push: false },
      clientChasingQuietHoursJson: { enabled: false, start: null, end: null, timezone: "Australia/Sydney" }
    } as any,
    create: {
      workspaceId: workspace.id,
      clientChasingEnabled: false,
      clientChasingAutoSendEnabled: false,
      clientChasingConsentRequired: true,
      clientChasingFrequencyHours: 48,
      clientChasingChannelsJson: { portal: true, email: true, sms: false, push: false },
      clientChasingQuietHoursJson: { enabled: false, start: null, end: null, timezone: "Australia/Sydney" }
    } as any
  });

  await prisma.auditEvent.deleteMany({ where: { workspaceId: workspace.id, action: { startsWith: "client_chasing." } } });
  await (prisma as any).clientChaseAttempt.deleteMany({ where: { workspaceId: workspace.id } });
  await (prisma as any).clientChasingPreference.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.matterTimelineEvent.deleteMany({ where: { workspaceId: workspace.id, eventType: { in: ["portal.team_message", "portal.reminder_posted"] } } });
  await prisma.documentRequestItem.deleteMany({ where: { request: { workspaceId: workspace.id } } });
  await prisma.documentRequest.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.matterReviewRequest.deleteMany({ where: { matter: { workspaceId: workspace.id } } });
  await prisma.matterApplicationDraft.deleteMany({ where: { matter: { workspaceId: workspace.id } } });
  await prisma.visaTemplateSection.deleteMany({ where: { template: { workspaceId: workspace.id, subclassCode: "999", version: "phase12" } } });
  await prisma.visaSubclassTemplate.deleteMany({ where: { workspaceId: workspace.id, subclassCode: "999", version: "phase12" } });
  await prisma.appointment.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.invoice.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.checklistItem.deleteMany({ where: { matter: { workspaceId: workspace.id } } });
  await prisma.matter.deleteMany({ where: { workspaceId: workspace.id, matterReference: { startsWith: "CHASE-" } } });
  await prisma.client.deleteMany({ where: { workspaceId: workspace.id, clientReference: { startsWith: "CHASE-" } } });

  const createClientMatter = async (suffix: string, assignedToUserId: string) => {
    const client = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        clientReference: `CHASE-${suffix}-CLIENT`,
        firstName: suffix,
        lastName: "Client",
        email: `${suffix.toLowerCase()}.client@example.com`,
        phone: `+6140000${String(Math.floor(Math.random() * 8999) + 1000)}`,
        dob: new Date("1994-01-01T00:00:00.000Z"),
        nationality: "Demo",
        assignedToUserId
      }
    });
    const matter = await prisma.matter.create({
      data: {
        workspaceId: workspace.id,
        matterReference: `CHASE-${suffix}-MATTER`,
        clientId: client.id,
        assignedToUserId,
        title: `${suffix} Matter`,
        visaSubclass: "500",
        visaStream: "Student",
        status: MatterStatus.IN_PROGRESS,
        stage: MatterStage.EVIDENCE,
        readinessScore: 42
      }
    });
    const checklistItem = await prisma.checklistItem.create({
      data: {
        matterId: matter.id,
        itemKey: `check-${suffix.toLowerCase()}`,
        category: "Identity",
        label: `${suffix} identity upload`,
        description: "Demo request",
        status: "REQUESTED",
        required: true,
        requestedAt: new Date(Date.now() - 86400000),
        dueDate: new Date(Date.now() + 2 * 86400000)
      }
    });
    return { client, matter, checklistItem };
  };

  const previewBundle = await createClientMatter("Preview", owner.id);
  const optOutBundle = await createClientMatter("OptOut", owner.id);
  const consentBundle = await createClientMatter("Consent", owner.id);

  const createDocumentRequest = async (bundle: Awaited<ReturnType<typeof createClientMatter>>, tokenKey: string) => {
    const request = await prisma.documentRequest.create({
      data: {
        workspaceId: workspace.id,
        clientId: bundle.client.id,
        matterId: bundle.matter.id,
        createdByUserId: owner.id,
        recipientName: `${bundle.client.firstName} ${bundle.client.lastName}`,
        recipientEmail: bundle.client.email,
        message: "Safe demo request.",
        dueDate: new Date(Date.now() + 2 * 86400000),
        status: DocumentRequestStatus.SENT,
        tokenHash: `phase12-docreq-${tokenKey}`,
        expiresAt: new Date(Date.now() + 7 * 86400000)
      }
    });
    await prisma.documentRequestItem.create({
      data: {
        requestId: request.id,
        checklistItemId: bundle.checklistItem.id,
        status: DocumentRequestItemStatus.MISSING
      }
    });
    return request;
  };

  const documentRequest = await createDocumentRequest(previewBundle, "preview");
  const optOutRequest = await createDocumentRequest(optOutBundle, "optout");
  const consentRequest = await createDocumentRequest(consentBundle, "consent");

  const template = await prisma.visaSubclassTemplate.create({
    data: {
      workspaceId: workspace.id,
      subclassCode: "999",
      stream: "Demo",
      name: "Phase 12 Demo Template",
      description: "Demo template for pending confirmation chasing.",
      version: "phase12",
      sections: {
        create: {
          key: "identity",
          title: "Identity",
          description: "Demo section",
          sortOrder: 1
        }
      }
    },
    include: { sections: true }
  });

  const draft = await prisma.matterApplicationDraft.create({
    data: {
      matterId: previewBundle.matter.id,
      templateId: template.id,
      status: DraftStatus.READY_FOR_AGENT_REVIEW,
      readinessScore: 55
    }
  });

  const reviewRequest = await prisma.matterReviewRequest.create({
    data: {
      matterId: previewBundle.matter.id,
      draftId: draft.id,
      status: ReviewRequestStatus.REVIEW_REQUESTED,
      recipientEmail: previewBundle.client.email,
      recipientName: `${previewBundle.client.firstName} ${previewBundle.client.lastName}`,
      message: "Demo review request",
      publicToken: "preview-only-token",
      publicTokenHash: "preview-only-token-hash",
      publicTokenPreview: "***iew",
      expiresAt: new Date(Date.now() + 3 * 86400000),
      sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  });

  const appointment = await prisma.appointment.create({
    data: {
      workspaceId: workspace.id,
      clientId: previewBundle.client.id,
      matterId: previewBundle.matter.id,
      assignedToUserId: owner.id,
      requestedByName: `${previewBundle.client.firstName} ${previewBundle.client.lastName}`,
      requestedByEmail: previewBundle.client.email,
      status: AppointmentStatus.CONFIRMED,
      meetingType: "Video",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      notes: "Demo appointment"
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: workspace.id,
      clientId: previewBundle.client.id,
      matterId: previewBundle.matter.id,
      createdByUserId: owner.id,
      clientName: `${previewBundle.client.firstName} ${previewBundle.client.lastName}`,
      clientEmail: previewBundle.client.email,
      invoiceNumber: "CHASE-INV-001",
      issueDate: new Date(Date.now() - 5 * 86400000),
      dueDate: new Date(Date.now() - 2 * 86400000),
      lineItemsJson: [{ label: "Professional fee", quantity: 1, unitAmountCents: 180000 }],
      subtotalCents: 180000,
      totalCents: 180000,
      status: InvoiceStatus.OVERDUE,
      reviewRequired: true
    }
  });

  const portalMessage = await prisma.matterTimelineEvent.create({
    data: {
      workspaceId: workspace.id,
      matterId: previewBundle.matter.id,
      actorUserId: owner.id,
      eventType: "portal.team_message",
      title: "Reminder from migration team",
      description: "Reminder: please check your secure client portal for an update."
    }
  });

  const scopedOwner: ScopedUser = {
    id: owner.id,
    workspaceId: workspace.id,
    role: owner.role,
    visibilityScope: owner.visibilityScope,
    status: owner.status,
    permissionsJson: owner.permissionsJson,
    email: owner.email,
    name: owner.name
  };

  return {
    workspace,
    owner,
    scopedOwner,
    previewBundle,
    optOutBundle,
    consentBundle,
    sources: {
      documentRequest,
      optOutRequest,
      consentRequest,
      reviewRequest,
      appointment,
      invoice,
      portalMessage
    }
  };
}

async function main() {
  const seeded = await seedWorkspace();
  const checks: Check[] = [];

  const initialSettings = await getClientChasingSettingsView(seeded.workspace.id);
  checks.push({
    name: "Workspace chasing is disabled by default and auto-send stays off",
    pass: !initialSettings.enabled && !initialSettings.autoSendEnabled && initialSettings.consentRequired
  });

  const savedSettings = await saveClientChasingSettings({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    enabled: true,
    autoSendEnabled: false,
    consentRequired: true,
    frequencyHours: 48,
    channels: { portal: true, email: true, sms: false, push: false },
    quietHours: { enabled: false, start: null, end: null, timezone: "Australia/Sydney" }
  });
  checks.push({
    name: "Workspace chasing settings save and keep auto-send off by default",
    pass:
      savedSettings.clientChasingEnabled &&
      !savedSettings.clientChasingAutoSendEnabled &&
      Boolean((savedSettings.clientChasingChannelsJson as any)?.portal) &&
      Boolean((savedSettings.clientChasingChannelsJson as any)?.email)
  });

  await upsertClientChasingPreference({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    clientId: seeded.previewBundle.client.id,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    portalEnabled: true,
    optedOutNonEssential: false
  });
  await upsertClientChasingPreference({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    clientId: seeded.optOutBundle.client.id,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    portalEnabled: true,
    optedOutNonEssential: true
  });

  const previews = await Promise.all([
    previewClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "missing_documents",
      sourceId: seeded.sources.documentRequest.id,
      channel: "portal"
    }),
    previewClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "pending_confirmation",
      sourceId: seeded.sources.reviewRequest.id,
      channel: "portal"
    }),
    previewClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "appointment",
      sourceId: seeded.sources.appointment.id,
      channel: "portal"
    }),
    previewClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "unpaid_invoice",
      sourceId: seeded.sources.invoice.id,
      channel: "portal"
    })
  ]);
  checks.push({
    name: "Safe reminder templates stay generic and exclude sensitive fields",
    pass: previews.every((item) => assertSafeCopy(item.preview.body) && !/token=|raw|document url|passport/i.test(item.preview.body))
  });

  const consentBlocked = await sendClientChase({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    sourceType: "missing_documents",
    sourceId: seeded.sources.consentRequest.id,
    channel: "portal"
  });
  checks.push({
    name: "Consent missing blocks non-essential chasing",
    pass: !consentBlocked.delivered && consentBlocked.status === ClientChaseStatus.BLOCKED && /consent|preference/i.test(consentBlocked.reason)
  });

  const optOutBlocked = await sendClientChase({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    sourceType: "missing_documents",
    sourceId: seeded.sources.optOutRequest.id,
    channel: "portal"
  });
  checks.push({
    name: "Opt-out blocks non-essential chasing",
    pass: !optOutBlocked.delivered && optOutBlocked.status === ClientChaseStatus.BLOCKED && /opt-out/i.test(optOutBlocked.reason)
  });

  const manualSend = await sendClientChase({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    sourceType: "missing_documents",
    sourceId: seeded.sources.documentRequest.id,
    channel: "portal"
  });
  checks.push({
    name: "Manual preview and send works with generic secure-portal wording",
    pass: manualSend.delivered && manualSend.status === ClientChaseStatus.SENT
  });

  const rateLimited = await sendClientChase({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner,
    sourceType: "missing_documents",
    sourceId: seeded.sources.documentRequest.id,
    channel: "portal"
  });
  checks.push({
    name: "Rate limiting blocks repeated chasing within the configured window",
    pass: !rateLimited.delivered && rateLimited.status === ClientChaseStatus.RATE_LIMITED
  });

  const scheduler = await runClientChasingScheduler({
    workspaceId: seeded.workspace.id,
    user: seeded.scopedOwner
  });
  checks.push({
    name: "Auto-send remains disabled by default unless explicitly enabled",
    pass: scheduler.autoSendEnabled === false && scheduler.sent === 0
  });

  const dashboard = await getClientChasingDashboard(seeded.workspace.id, seeded.scopedOwner);
  checks.push({
    name: "Dashboard shows pending chases and history",
    pass: dashboard.pending.length >= 5 && dashboard.history.some((item) => item.status === "SENT") && dashboard.history.some((item) => item.status === "RATE_LIMITED")
  });

  const timelineReminder = await prisma.matterTimelineEvent.findFirst({
    where: {
      workspaceId: seeded.workspace.id,
      matterId: seeded.previewBundle.matter.id,
      eventType: "portal.reminder_posted"
    },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Manual send uses existing provider-safe portal hook",
    pass: Boolean(timelineReminder) && assertSafeCopy(timelineReminder?.description || "")
  });

  const auditRows = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { startsWith: "client_chasing." } },
    orderBy: { createdAt: "desc" }
  });
  const auditJson = JSON.stringify(auditRows);
  checks.push({
    name: "Audit metadata is redacted and excludes client secrets",
    pass: !/preview\.client@example\.com|\+614|tokenHash|publicToken|storageKey|passport/i.test(auditJson)
  });

  const workspaceRows = await getWorkspaceRows();
  const joinedRows = safeJson(workspaceRows);
  checks.push({
    name: "Platform admin metadata stays redacted and excludes private chasing content",
    pass: !/preview\.client@example\.com|phase12-docreq|Reminder from migration team|publicToken/i.test(joinedRows)
  });

  const swSource = fs.readFileSync(path.join(ROOT, "public", "aria-push-sw.js"), "utf8");
  checks.push({
    name: "Service worker does not cache private portal document or export routes",
    pass: !/caches\.|addEventListener\(\"fetch\"|evidence|documents|upload|download|payment|cloud-drive|email-sync|portal\/\[token\]/i.test(swSource)
  });

  const pass = checks.every((check) => check.pass);
  console.log(JSON.stringify({ pass, checks }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());
