import { type ChildProcess } from "node:child_process";
import { hash } from "bcryptjs";
import {
  DeadlineStatus,
  DocumentRequestStatus,
  DraftStatus,
  ExtractionStatus,
  FieldStatus,
  InvoiceStatus,
  IssueSeverity,
  MatterStage,
  MatterStatus,
  ResolutionStatus,
  ReviewRequestStatus,
  ReviewStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole, permissionDefinitions } from "@/lib/services/roles";
import { resolveChromiumExecutable, startNextDevServer } from "@/scripts/helpers/cross-platform-runtime";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";

loadScriptEnv();

const prismaAny = prisma as any;

export const MATTER_HEALTH_ROOT = process.cwd();
export const MATTER_HEALTH_WORKSPACE_SLUG = "matter-health-readiness";
export const MATTER_HEALTH_OWNER_EMAIL = "matter.health.owner@example.com";
export const MATTER_HEALTH_OWNER_PASSWORD = "Matter-Health-Owner-2026!";
export const MATTER_HEALTH_BLOCKED_EMAIL = "matter.health.blocked@example.com";
export const MATTER_HEALTH_BLOCKED_PASSWORD = "Matter-Health-Blocked-2026!";

type LoginMode = "public" | "workspace";

function falsePermissions() {
  return permissionDefinitions.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>);
}

export function chromiumExecutable() {
  return resolveChromiumExecutable();
}

export async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForApp(url: string, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status < 500) return true;
    } catch {}
    await wait(1000);
  }
  return false;
}

export async function startServer(port: number): Promise<ChildProcess> {
  const child = startNextDevServer(MATTER_HEALTH_ROOT, port, {
    PLATFORM_ADMIN_EMAILS: MATTER_HEALTH_OWNER_EMAIL
  });
  const ready = await waitForApp(`http://localhost:${port}`);
  if (!ready) {
    child.kill();
    throw new Error(`Local app did not become available at http://localhost:${port}`);
  }
  return child;
}

export async function stopServer(child: ChildProcess | null) {
  if (!child) return;
  if (child.exitCode !== null || child.killed) {
    await wait(250);
    return;
  }

  child.kill();
  const exited = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
    await wait(1000);
  }
}

export async function login(page: any, baseUrl: string, email: string, password: string, mode: LoginMode) {
  const usePublicPortal = mode === "public";
  const errorPattern = usePublicPortal
    ? /Unable to sign in right now\.|Email or password is incorrect\.|Staff and agents sign in through their firm workspace portal, not the public owner portal\.|Your staff invite has not been accepted yet\.|Your account has been deactivated\.|Your account setup is incomplete\./i
    : /Unable to sign in to this workspace right now\.|Invite not accepted yet\.|Your account is not active yet\.|This email belongs to a different workspace\.|Your account has been deactivated\.|Email or password is incorrect for this workspace\./i;
  const loginPath = usePublicPortal ? "/auth/sign-in" : `/w/${MATTER_HEALTH_WORKSPACE_SLUG}/login`;
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: "domcontentloaded" });
  const csrf = await (await page.request.get(`${baseUrl}/api/auth/csrf`)).json() as { csrfToken?: string };
  if (!csrf.csrfToken) {
    throw new Error(`Login failed for ${email}: csrf token missing`);
  }

  const response = await page.request.post(`${baseUrl}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrf.csrfToken,
      email,
      password,
      ...(usePublicPortal ? {} : { workspaceSlug: MATTER_HEALTH_WORKSPACE_SLUG }),
      redirect: "false",
      json: "true"
    }
  });

  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: credential callback returned HTTP ${response.status()}`);
  }

  await page.goto(`${baseUrl}/app/overview`, { waitUntil: "domcontentloaded" });
  const loginStartedAt = Date.now();
  while (Date.now() - loginStartedAt < 90_000) {
    const currentPath = new URL(page.url()).pathname;
    if (currentPath.startsWith("/app/")) {
      return;
    }

    const errorText =
      (await page
        .locator("form p")
        .filter({ hasText: errorPattern })
        .first()
        .textContent()
        .catch(() => null)) ?? null;

    if (errorText) {
      throw new Error(`Login failed for ${email}: ${errorText.trim()}`);
    }

    await wait(1000);
  }

  const currentPath = new URL(page.url()).pathname;
  const visibleHeading =
    (await page
      .locator("h1, h2, [role='heading']")
      .filter({ hasText: /\S/ })
      .first()
      .textContent()
      .catch(() => null)) ?? null;
  const responseStatus = await page
    .mainFrame()
    .response()
    .then((value: any) => value?.status?.() ?? null)
    .catch(() => null);

  throw new Error(
    `Login did not reach the app for ${email}. Current path: ${currentPath}. Response status: ${responseStatus ?? "unknown"}. Visible heading: ${visibleHeading?.trim().slice(0, 160) ?? "none"}.`
  );
}

async function cleanupWorkspace(workspaceId: string) {
  await prisma.auditEvent.deleteMany({
    where: {
      workspaceId,
      OR: [
        { action: { startsWith: "matter_health." } },
        { action: "notification.created" },
        { action: "access.denied" }
      ]
    }
  });
  await prismaAny.pushEvent.deleteMany({ where: { workspaceId } });
  await prismaAny.inAppNotification.deleteMany({ where: { workspaceId } });
  await prisma.documentRequestItem.deleteMany({ where: { request: { workspaceId } } });
  await prisma.documentRequest.deleteMany({ where: { workspaceId } });
  await prisma.matterReviewRequest.deleteMany({ where: { matter: { workspaceId } } });
  await prisma.matterApplicationDraft.deleteMany({ where: { matter: { workspaceId } } });
  await prisma.task.deleteMany({ where: { workspaceId } });
  await prisma.validationIssue.deleteMany({ where: { matter: { workspaceId } } });
  await prisma.extractedField.deleteMany({ where: { matter: { workspaceId } } });
  await prisma.document.deleteMany({ where: { workspaceId } });
  await prismaAny.deadlineEvent.deleteMany({ where: { workspaceId } });
  await prismaAny.matterDeadline.deleteMany({ where: { workspaceId } });
  await prisma.invoice.deleteMany({ where: { workspaceId, invoiceNumber: { startsWith: "HEALTH-" } } });
  await prisma.checklistItem.deleteMany({ where: { matter: { workspaceId } } });
  await prisma.matter.deleteMany({ where: { workspaceId, matterReference: { startsWith: "HEALTH-" } } });
  await prisma.client.deleteMany({ where: { workspaceId, clientReference: { startsWith: "HEALTH-" } } });
  await prisma.visaSubclassTemplate.deleteMany({ where: { workspaceId, subclassCode: "HEALTH" } });
}

export async function seedMatterHealthWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: MATTER_HEALTH_WORKSPACE_SLUG },
    update: { name: "Matter Health Readiness", plan: WorkspacePlan.PRO, contactEmail: MATTER_HEALTH_OWNER_EMAIL },
    create: { slug: MATTER_HEALTH_WORKSPACE_SLUG, name: "Matter Health Readiness", plan: WorkspacePlan.PRO, contactEmail: MATTER_HEALTH_OWNER_EMAIL }
  });

  const owner = await prisma.user.upsert({
    where: { email: MATTER_HEALTH_OWNER_EMAIL },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(MATTER_HEALTH_OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      name: "Matter Health Owner",
      email: MATTER_HEALTH_OWNER_EMAIL,
      hashedPassword: await hash(MATTER_HEALTH_OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const blockedUser = await prisma.user.upsert({
    where: { email: MATTER_HEALTH_BLOCKED_EMAIL },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(MATTER_HEALTH_BLOCKED_PASSWORD, 12),
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: falsePermissions(),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      name: "Matter Health Blocked",
      email: MATTER_HEALTH_BLOCKED_EMAIL,
      hashedPassword: await hash(MATTER_HEALTH_BLOCKED_PASSWORD, 12),
      role: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: falsePermissions(),
      inviteAcceptedAt: new Date()
    }
  });

  await cleanupWorkspace(workspace.id);

  const template = await prisma.visaSubclassTemplate.create({
    data: {
      workspaceId: workspace.id,
      subclassCode: "HEALTH",
      stream: "Demo",
      name: "Matter Health Template",
      description: "Readiness-only template for matter health proof.",
      version: `phase14-${Date.now()}`
    }
  });

  async function createClientMatter(input: {
    suffix: string;
    title: string;
    readinessScore: number;
    stage: MatterStage;
  }) {
    const client = await prisma.client.create({
      data: {
        workspaceId: workspace.id,
        clientReference: `HEALTH-${input.suffix}-CLIENT`,
        firstName: input.suffix,
        lastName: "Proof",
        email: `${input.suffix.toLowerCase()}.health@example.com`,
        phone: `+6149${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`,
        dob: new Date("1992-01-01T00:00:00.000Z"),
        nationality: "Demo",
        assignedToUserId: owner.id
      }
    });

    const matter = await prisma.matter.create({
      data: {
        workspaceId: workspace.id,
        matterReference: `HEALTH-${input.suffix}-MATTER`,
        clientId: client.id,
        assignedToUserId: owner.id,
        title: input.title,
        visaSubclass: "500",
        visaStream: "Student",
        status: MatterStatus.IN_PROGRESS,
        stage: input.stage,
        readinessScore: input.readinessScore,
        criticalDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lodgementTargetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
      }
    });

    return { client, matter };
  }

  const green = await createClientMatter({
    suffix: "GREEN",
    title: "Green Health Matter",
    readinessScore: 91,
    stage: MatterStage.VALIDATION
  });
  const amber = await createClientMatter({
    suffix: "AMBER",
    title: "Amber Health Matter",
    readinessScore: 67,
    stage: MatterStage.FIELD_REVIEW
  });
  const red = await createClientMatter({
    suffix: "RED",
    title: "Red Health Matter",
    readinessScore: 34,
    stage: MatterStage.EVIDENCE
  });

  const greenDocument = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: green.client.id,
      matterId: green.matter.id,
      fileName: "green-evidence.pdf",
      storageKey: "demo/matter-health/green-evidence.pdf",
      mimeType: "application/pdf",
      category: "Evidence",
      uploadedByUserId: owner.id,
      extractionStatus: ExtractionStatus.EXTRACTED,
      reviewStatus: ReviewStatus.VERIFIED
    }
  });

  const amberDocument = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: amber.client.id,
      matterId: amber.matter.id,
      fileName: "amber-evidence.pdf",
      storageKey: "demo/matter-health/amber-evidence.pdf",
      mimeType: "application/pdf",
      category: "Evidence",
      uploadedByUserId: owner.id,
      extractionStatus: ExtractionStatus.NEEDS_REVIEW,
      reviewStatus: ReviewStatus.PENDING
    }
  });

  const redDocument = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: red.client.id,
      matterId: red.matter.id,
      fileName: "red-evidence.pdf",
      storageKey: "demo/matter-health/red-evidence.pdf",
      mimeType: "application/pdf",
      category: "Evidence",
      uploadedByUserId: owner.id,
      extractionStatus: ExtractionStatus.NEEDS_REVIEW,
      reviewStatus: ReviewStatus.FLAGGED
    }
  });

  await prisma.checklistItem.createMany({
    data: [
      {
        matterId: green.matter.id,
        documentId: greenDocument.id,
        itemKey: "green-proof",
        category: "Identity",
        label: "Identity evidence linked",
        status: "RECEIVED",
        required: true
      },
      {
        matterId: amber.matter.id,
        documentId: amberDocument.id,
        itemKey: "amber-proof",
        category: "Evidence",
        label: "Evidence uploaded and awaiting confirmation",
        status: "REQUESTED",
        required: true
      },
      {
        matterId: red.matter.id,
        itemKey: "red-proof-1",
        category: "Identity",
        label: "Required identity evidence",
        status: "REQUESTED",
        required: true
      },
      {
        matterId: red.matter.id,
        itemKey: "red-proof-2",
        category: "Financial",
        label: "Required support evidence",
        status: "REQUESTED",
        required: true
      }
    ]
  });

  await prisma.extractedField.createMany({
    data: [
      {
        matterId: green.matter.id,
        documentId: greenDocument.id,
        fieldKey: "client_name",
        fieldLabel: "Client name",
        fieldValue: "Verified",
        confidence: 0.99,
        sourceSnippet: "Verified source",
        sourcePageRef: "1",
        status: FieldStatus.VERIFIED,
        needsReview: false
      },
      {
        matterId: amber.matter.id,
        documentId: amberDocument.id,
        fieldKey: "evidence_note",
        fieldLabel: "Evidence note",
        fieldValue: "Review required",
        confidence: 0.58,
        sourceSnippet: "Review source",
        sourcePageRef: "1",
        status: FieldStatus.NEEDS_REVIEW,
        needsReview: true
      },
      {
        matterId: red.matter.id,
        documentId: redDocument.id,
        fieldKey: "evidence_conflict",
        fieldLabel: "Evidence conflict",
        fieldValue: "Conflicting source",
        confidence: 0.44,
        sourceSnippet: "Conflicting source",
        sourcePageRef: "2",
        status: FieldStatus.CONFLICTING,
        needsReview: true
      }
    ]
  });

  await prisma.validationIssue.createMany({
    data: [
      {
        matterId: red.matter.id,
        severity: IssueSeverity.CRITICAL,
        type: "evidence_conflict",
        title: "Critical evidence conflict",
        description: "Review-required evidence conflict.",
        resolutionStatus: ResolutionStatus.OPEN
      },
      {
        matterId: red.matter.id,
        severity: IssueSeverity.HIGH,
        type: "review_gap",
        title: "High-priority review blocker",
        description: "Operational blocker requiring agent review.",
        resolutionStatus: ResolutionStatus.IN_PROGRESS
      }
    ]
  });

  await prisma.task.createMany({
    data: [
      {
        workspaceId: workspace.id,
        matterId: red.matter.id,
        assignedToUserId: owner.id,
        createdByUserId: owner.id,
        title: "Resolve red matter blocker",
        description: "Demo task",
        safeDescription: "Internal blocker follow-up.",
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: TaskStatus.BLOCKED,
        priority: TaskPriority.URGENT,
        category: "Review"
      }
    ]
  });

  await prisma.invoice.create({
    data: {
      workspaceId: workspace.id,
      clientId: red.client.id,
      matterId: red.matter.id,
      createdByUserId: owner.id,
      clientName: `${red.client.firstName} ${red.client.lastName}`,
      clientEmail: red.client.email,
      invoiceNumber: `HEALTH-INV-${Date.now()}`,
      issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      currency: "AUD",
      subtotalCents: 100000,
      totalCents: 100000,
      lineItemsJson: [{ description: "Matter health proof invoice", quantity: 1, amountCents: 100000 }],
      reviewRequired: true,
      status: InvoiceStatus.OVERDUE
    }
  });

  await prismaAny.matterDeadline.createMany({
    data: [
      {
        workspaceId: workspace.id,
        matterId: amber.matter.id,
        clientId: amber.client.id,
        assignedToUserId: owner.id,
        createdByUserId: owner.id,
        title: "Amber review due soon",
        safeSummary: "Urgent review reminder.",
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: DeadlineStatus.OPEN,
        category: "review_required",
        sourceType: "MANUAL",
        reviewRequired: true,
        clientVisible: false,
        sourceLabel: "Manual deadline"
      },
      {
        workspaceId: workspace.id,
        matterId: red.matter.id,
        clientId: red.client.id,
        assignedToUserId: owner.id,
        createdByUserId: owner.id,
        title: "Red deadline overdue",
        safeSummary: "Overdue operational deadline.",
        dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: DeadlineStatus.OPEN,
        category: "critical_deadline",
        sourceType: "MANUAL",
        reviewRequired: true,
        clientVisible: false,
        sourceLabel: "Manual deadline"
      }
    ]
  });

  const amberDraft = await prisma.matterApplicationDraft.create({
    data: {
      matterId: amber.matter.id,
      templateId: template.id,
      status: DraftStatus.READY_FOR_AGENT_REVIEW,
      readinessScore: 63
    }
  });

  const redDraft = await prisma.matterApplicationDraft.create({
    data: {
      matterId: red.matter.id,
      templateId: template.id,
      status: DraftStatus.NEEDS_WORK,
      readinessScore: 29
    }
  });

  await prisma.matterReviewRequest.createMany({
    data: [
      {
        matterId: amber.matter.id,
        draftId: amberDraft.id,
        status: ReviewRequestStatus.SENT_TO_CLIENT,
        recipientEmail: amber.client.email,
        recipientName: `${amber.client.firstName} ${amber.client.lastName}`,
        message: "Please review in the secure portal.",
        publicToken: `amber-health-review-${Date.now()}`,
        publicTokenHash: `amber-health-review-hash-${Date.now()}`,
        publicTokenPreview: "amber-preview",
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        sentAt: new Date()
      },
      {
        matterId: red.matter.id,
        draftId: redDraft.id,
        status: ReviewRequestStatus.SENT_TO_CLIENT,
        recipientEmail: red.client.email,
        recipientName: `${red.client.firstName} ${red.client.lastName}`,
        message: "Please review in the secure portal.",
        publicToken: `red-health-review-${Date.now()}`,
        publicTokenHash: `red-health-review-hash-${Date.now()}`,
        publicTokenPreview: "red-preview",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  await prisma.documentRequest.create({
    data: {
      workspaceId: workspace.id,
      clientId: red.client.id,
      matterId: red.matter.id,
      createdByUserId: owner.id,
      recipientName: `${red.client.firstName} ${red.client.lastName}`,
      recipientEmail: red.client.email,
      message: "Please review in the secure portal.",
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: DocumentRequestStatus.SENT,
      tokenHash: `health-docreq-${Date.now()}`,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: { pushEnabled: true, pushAgentAlertsEnabled: true } as any,
    create: { workspaceId: workspace.id, pushEnabled: true, pushAgentAlertsEnabled: true } as any
  });

  return {
    workspace,
    owner,
    blockedUser,
    green,
    amber,
    red
  };
}
