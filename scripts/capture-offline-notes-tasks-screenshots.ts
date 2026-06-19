import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { type ChildProcess } from "node:child_process";
import { hash } from "bcryptjs";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  MatterStage,
  MatterStatus,
  TaskPriority,
  TaskStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/services/offline/offline-task-sync";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { upsertNotificationPreference } from "@/lib/services/push/push-consent";
import { resolveChromiumExecutable, startNextDevServer } from "@/scripts/helpers/cross-platform-runtime";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";

loadScriptEnv();

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "offline-notes-tasks-proof");
const BASE_URL = "http://localhost:3027";
const WORKSPACE_SLUG = "offline-notes-tasks-proof";
const OWNER_EMAIL = "offline.proof.owner@example.com";
const OWNER_PASSWORD = "Offline-Proof-2026!";

function chromiumExecutable() {
  return resolveChromiumExecutable();
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApp(url: string, timeoutMs = 90000) {
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
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30000 });
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Offline Tasks Proof", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    create: { slug: WORKSPACE_SLUG, name: "Offline Tasks Proof", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
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
      name: "Offline Proof Owner",
      email: OWNER_EMAIL,
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const teammate = await prisma.user.upsert({
    where: { email: "offline.proof.teammate@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Offline Proof Teammate",
      email: "offline.proof.teammate@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "OFFLINE-PROOF-CLIENT" },
    update: { workspaceId: workspace.id, assignedToUserId: owner.id },
    create: {
      workspaceId: workspace.id,
      clientReference: "OFFLINE-PROOF-CLIENT",
      firstName: "Nora",
      lastName: "Proof",
      dob: new Date("1993-03-18T00:00:00.000Z"),
      nationality: "Demo",
      email: "offline.proof.client@example.com",
      phone: "+61400000221",
      assignedToUserId: owner.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "OFFLINE-PROOF-MATTER" },
    update: { workspaceId: workspace.id, clientId: client.id, assignedToUserId: owner.id, title: "Offline Proof Matter" },
    create: {
      workspaceId: workspace.id,
      matterReference: "OFFLINE-PROOF-MATTER",
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Offline Proof Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 48
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: { pushEnabled: true, pushAgentAlertsEnabled: true } as any,
    create: { workspaceId: workspace.id, pushEnabled: true, pushAgentAlertsEnabled: true } as any
  });
  await upsertNotificationPreference({ workspaceId: workspace.id, userId: owner.id, pushEnabled: true, inAppEnabled: true });

  await prisma.task.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });

  const task = await createTask({
    workspaceId: workspace.id,
    actor: owner,
    data: {
      matterId: matter.id,
      matterReferenceSnapshot: matter.matterReference,
      assignedToUserId: owner.id,
      title: "Prepare review checklist",
      safeDescription: "Low-risk task for proof screenshots.",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      status: TaskStatus.OPEN,
      priority: TaskPriority.HIGH,
      category: "Review",
      offlineCreatedAt: null
    }
  });

  return { workspace, owner, teammate, matter, task };
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const seeded = await seedDemo();
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    server = await startServer(3027);
    browser = await openBrowser();

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const page = await desktop.newPage();
    await login(page);
    await page.goto(`${BASE_URL}/app/tasks`, { waitUntil: "networkidle" });
    await saveShot(page, "01-task-dashboard.png");

    await page.getByRole("button", { name: "Create task" }).click();
    await saveShot(page, "02-create-task.png");
    await saveShot(page, "09-offline-safety-notice.png");

    await page.context().setOffline(true);
    await saveShot(page, "03-offline-banner.png");
    await page.getByLabel("Task title").fill("Offline sync reminder");
    await page.getByLabel("Offline-safe note draft").fill("Queued safely while offline.");
    await page.getByRole("button", { name: "Queue offline task" }).click();
    await saveShot(page, "04-pending-sync-badge.png");

    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByLabel("Task title").fill("Unsafe offline note");
    await page.getByLabel("Offline-safe note draft").fill("passport number X9999999");
    await page.getByRole("button", { name: "Queue offline task" }).click();
    await saveShot(page, "08-sensitive-offline-content-blocked-warning.png");

    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Sync now" }).click();
    await page.waitForTimeout(1500);
    await saveShot(page, "05-sync-completed-state.png");

    const freshTask = await prisma.task.findFirst({
      where: { workspaceId: seeded.workspace.id, title: "Prepare review checklist" },
      include: { assignedToUser: true, createdByUser: true, matter: { include: { client: true, assignedToUser: true } } }
    });
    if (freshTask) {
      await prisma.task.update({
        where: { id: freshTask.id },
        data: { status: TaskStatus.IN_PROGRESS }
      });
    }

    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Offline-safe note draft").fill("Queued conflicting change.");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Queue task update" }).click();
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Sync now" }).click();
    await page.waitForTimeout(1500);
    await saveShot(page, "06-conflict-detected-state.png");
    await saveShot(page, "07-conflict-resolution-state.png");

    await page.goto(`${BASE_URL}/app/settings/notifications`, { waitUntil: "networkidle" });
    await saveShot(page, "10-task-assignment-notification.png");

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    });
    const mobilePage = await mobile.newPage();
    await login(mobilePage);
    await mobilePage.goto(`${BASE_URL}/app/tasks`, { waitUntil: "networkidle" });
    await saveShot(mobilePage, "11-mobile-task-view.png");
    await mobile.close();
  } finally {
    await browser?.close().catch(() => null);
    await stopServer(server);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
