import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { type ChildProcess } from "node:child_process";
import { hash } from "bcryptjs";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  AppointmentStatus,
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
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { resolveChromiumExecutable, startNextDevServer } from "@/scripts/helpers/cross-platform-runtime";
import { sendClientChase, type ScopedUser, upsertClientChasingPreference } from "@/lib/services/chasing/client-chasing-service";

loadScriptEnv();

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "client-chasing-proof");
const BASE_URL = "http://localhost:3028";
const WORKSPACE_SLUG = "client-chasing-proof";
const OWNER_EMAIL = "chasing.proof.owner@example.com";
const OWNER_PASSWORD = "Chasing-Proof-2026!";

function chromiumExecutable() {
  return resolveChromiumExecutable();
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApp(url: string, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status < 500) return true;
    } catch {}
    await wait(1000);
  }
  return false;
}

async function startServer(port: number): Promise<ChildProcess> {
  const child = startNextDevServer(ROOT, port, {
    PLATFORM_ADMIN_EMAILS: OWNER_EMAIL
  });
  const ready = await waitForApp(`http://localhost:${port}`);
  if (!ready) {
    child.kill();
    throw new Error(`Local app did not become available at http://localhost:${port}`);
  }
  return child;
}

async function stopServer(child: ChildProcess | null) {
  if (!child) return;
  child.kill();
  await wait(1500);
}

async function openBrowser() {
  return chromium.launch({ executablePath: chromiumExecutable(), headless: true });
}

async function saveShot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForFunction(() => window.location.pathname.startsWith("/app/"), undefined, { timeout: 90000 });
}

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Client Chasing Proof", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    create: { slug: WORKSPACE_SLUG, name: "Client Chasing Proof", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
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
      name: "Chasing Proof Owner",
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
  await prisma.visaTemplateSection.deleteMany({ where: { template: { workspaceId: workspace.id, subclassCode: "998", version: "phase12-proof" } } });
  await prisma.visaSubclassTemplate.deleteMany({ where: { workspaceId: workspace.id, subclassCode: "998", version: "phase12-proof" } });
  await prisma.appointment.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.invoice.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.checklistItem.deleteMany({ where: { matter: { workspaceId: workspace.id } } });
  await prisma.matter.deleteMany({ where: { workspaceId: workspace.id, matterReference: { startsWith: "CHASE-PROOF-" } } });
  await prisma.client.deleteMany({ where: { workspaceId: workspace.id, clientReference: { startsWith: "CHASE-PROOF-" } } });

  const createClientMatter = async (suffix: string) => {
    const client = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        clientReference: `CHASE-PROOF-${suffix.toUpperCase()}-CLIENT`,
        firstName: suffix,
        lastName: "Client",
        email: `${suffix.toLowerCase()}.proof@example.com`,
        phone: `+6141100${String(Math.floor(Math.random() * 8999) + 1000)}`,
        dob: new Date("1994-01-01T00:00:00.000Z"),
        nationality: "Demo",
        assignedToUserId: owner.id
      }
    });
    const matter = await prisma.matter.create({
      data: {
        workspaceId: workspace.id,
        matterReference: `CHASE-PROOF-${suffix.toUpperCase()}-MATTER`,
        clientId: client.id,
        assignedToUserId: owner.id,
        title: `${suffix} Matter`,
        visaSubclass: "500",
        visaStream: "Student",
        status: MatterStatus.IN_PROGRESS,
        stage: MatterStage.EVIDENCE,
        readinessScore: 44
      }
    });
    const checklistItem = await prisma.checklistItem.create({
      data: {
        matterId: matter.id,
        itemKey: `proof-${suffix.toLowerCase()}`,
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

  const previewBundle = await createClientMatter("Preview");
  const optOutBundle = await createClientMatter("Optout");
  const consentBundle = await createClientMatter("Consent");

  const createDocumentRequest = async (bundle: Awaited<ReturnType<typeof createClientMatter>>, key: string) => {
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
        tokenHash: `phase12-proof-docreq-${key}`,
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
  await createDocumentRequest(optOutBundle, "optout");
  await createDocumentRequest(consentBundle, "consent");

  const template = await prisma.visaSubclassTemplate.create({
    data: {
      workspaceId: workspace.id,
      subclassCode: "998",
      stream: "Demo",
      name: "Phase 12 Proof Template",
      description: "Demo template for screenshots.",
      version: "phase12-proof",
      sections: {
        create: {
          key: "identity",
          title: "Identity",
          description: "Demo section",
          sortOrder: 1
        }
      }
    }
  });

  const draft = await prisma.matterApplicationDraft.create({
    data: {
      matterId: previewBundle.matter.id,
      templateId: template.id,
      status: DraftStatus.READY_FOR_AGENT_REVIEW,
      readinessScore: 61
    }
  });

  await prisma.matterReviewRequest.create({
    data: {
      matterId: previewBundle.matter.id,
      draftId: draft.id,
      status: ReviewRequestStatus.REVIEW_REQUESTED,
      recipientEmail: previewBundle.client.email,
      recipientName: `${previewBundle.client.firstName} ${previewBundle.client.lastName}`,
      message: "Demo review request",
      publicToken: "proof-preview-token",
      publicTokenHash: "proof-preview-token-hash",
      publicTokenPreview: "***iew",
      expiresAt: new Date(Date.now() + 3 * 86400000)
    }
  });

  await prisma.appointment.create({
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

  await prisma.invoice.create({
    data: {
      workspaceId: workspace.id,
      clientId: previewBundle.client.id,
      matterId: previewBundle.matter.id,
      createdByUserId: owner.id,
      clientName: `${previewBundle.client.firstName} ${previewBundle.client.lastName}`,
      clientEmail: previewBundle.client.email,
      invoiceNumber: "CHASE-PROOF-INV-001",
      issueDate: new Date(Date.now() - 5 * 86400000),
      dueDate: new Date(Date.now() - 2 * 86400000),
      lineItemsJson: [{ label: "Professional fee", quantity: 1, unitAmountCents: 180000 }],
      subtotalCents: 180000,
      totalCents: 180000,
      status: InvoiceStatus.OVERDUE,
      reviewRequired: true
    }
  });

  await prisma.matterTimelineEvent.create({
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

  await upsertClientChasingPreference({
    workspaceId: workspace.id,
    user: scopedOwner,
    clientId: previewBundle.client.id,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    portalEnabled: true,
    optedOutNonEssential: false
  });
  await upsertClientChasingPreference({
    workspaceId: workspace.id,
    user: scopedOwner,
    clientId: optOutBundle.client.id,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    portalEnabled: true,
    optedOutNonEssential: true
  });

  return { workspace, owner, scopedOwner, previewBundle, documentRequest };
}

async function enableChasing(workspaceId: string) {
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId },
    data: { clientChasingEnabled: true, clientChasingAutoSendEnabled: false } as any
  });
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const seeded = await seedWorkspace();
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    server = await startServer(3028);
    browser = await openBrowser();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/chasing`, { waitUntil: "networkidle" });
    await saveShot(page, "01-chasing-dashboard-panel.png");

    await page.locator("text=Workspace chasing settings").first().scrollIntoViewIfNeeded();
    await saveShot(page, "02-workspace-chasing-settings.png");
    await saveShot(page, "03-disabled-default-state.png");

    const previewDocCard = page.locator("div.rounded-2xl").filter({ hasText: "Preview Client" }).filter({ hasText: "Pending document reminder" }).first();
    await previewDocCard.getByRole("button", { name: "Preview portal" }).click();
    await page.waitForTimeout(800);
    await page.locator("text=Reminder preview").first().scrollIntoViewIfNeeded();
    await saveShot(page, "04-pending-document-reminder-preview.png");

    const previewConfirmationCard = page.locator("div.rounded-2xl").filter({ hasText: "Preview Client" }).filter({ hasText: "Pending confirmation reminder" }).first();
    await previewConfirmationCard.getByRole("button", { name: "Preview portal" }).click();
    await page.waitForTimeout(800);
    await saveShot(page, "05-pending-confirmation-reminder-preview.png");

    const previewAppointmentCard = page.locator("div.rounded-2xl").filter({ hasText: "Preview Client" }).filter({ hasText: "Appointment reminder" }).first();
    await previewAppointmentCard.getByRole("button", { name: "Preview portal" }).click();
    await page.waitForTimeout(800);
    await saveShot(page, "06-appointment-reminder-preview.png");

    const previewInvoiceCard = page.locator("div.rounded-2xl").filter({ hasText: "Preview Client" }).filter({ hasText: "Invoice reminder" }).first();
    await previewInvoiceCard.getByRole("button", { name: "Preview portal" }).click();
    await page.waitForTimeout(800);
    await saveShot(page, "07-invoice-reminder-preview.png");

    await page.locator("text=Optout Client").first().scrollIntoViewIfNeeded();
    await saveShot(page, "08-opt-out-blocked-state.png");

    await page.locator("text=Consent Client").first().scrollIntoViewIfNeeded();
    await saveShot(page, "09-consent-missing-blocked-state.png");

    await enableChasing(seeded.workspace.id);
    await sendClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "missing_documents",
      sourceId: seeded.documentRequest.id,
      channel: "portal"
    });
    await sendClientChase({
      workspaceId: seeded.workspace.id,
      user: seeded.scopedOwner,
      sourceType: "missing_documents",
      sourceId: seeded.documentRequest.id,
      channel: "portal"
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.locator("text=Sent and blocked history").first().scrollIntoViewIfNeeded();
    await saveShot(page, "10-rate-limited-state.png");
    await saveShot(page, "11-sent-history-state.png");

    await page.locator("text=Redacted audit view").first().scrollIntoViewIfNeeded();
    await saveShot(page, "12-redacted-audit-view.png");
  } finally {
    await browser?.close().catch(() => null);
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
