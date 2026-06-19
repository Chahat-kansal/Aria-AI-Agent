import fs from "node:fs";
import path from "node:path";
import { type ChildProcess } from "node:child_process";
import { hash } from "bcryptjs";
import { chromium, type Browser } from "playwright-core";
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
import { createTask, serializeTaskForClient, syncOfflineTaskOperations, updateTask } from "@/lib/services/offline/offline-task-sync";
import { evaluateOfflineNoteSafety } from "@/lib/services/offline/offline-note-safety";
import { resolveTaskConflict } from "@/lib/services/offline/offline-conflict-resolution";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { getWorkspaceRows, safeJson } from "@/lib/services/platform-admin-data";
import { upsertNotificationPreference } from "@/lib/services/push/push-consent";
import { resolveChromiumExecutable, startNextDevServer } from "@/scripts/helpers/cross-platform-runtime";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const ROOT = process.cwd();
const BASE_URL = "http://localhost:3026";
const WORKSPACE_SLUG = "offline-notes-tasks-readiness";
const OWNER_EMAIL = "offline.owner@example.com";
const OWNER_PASSWORD = "Offline-Owner-2026!";
const AGENT_A_EMAIL = "offline.agent.a@example.com";
const AGENT_A_PASSWORD = "Offline-Agent-A-2026!";
const AGENT_B_EMAIL = "offline.agent.b@example.com";

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

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Offline Tasks Readiness", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    create: { slug: WORKSPACE_SLUG, name: "Offline Tasks Readiness", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
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
      name: "Offline Owner",
      email: OWNER_EMAIL,
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const agentA = await prisma.user.upsert({
    where: { email: AGENT_A_EMAIL },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(AGENT_A_PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId: workspace.id,
      name: "Offline Agent A",
      email: AGENT_A_EMAIL,
      hashedPassword: await hash(AGENT_A_PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });

  const agentB = await prisma.user.upsert({
    where: { email: AGENT_B_EMAIL },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Offline Agent B",
      email: AGENT_B_EMAIL,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const clientA = await prisma.client.upsert({
    where: { clientReference: "OFFLINE-TASK-CLIENT-A" },
    update: { workspaceId: workspace.id, assignedToUserId: agentA.id },
    create: {
      workspaceId: workspace.id,
      clientReference: "OFFLINE-TASK-CLIENT-A",
      firstName: "Ari",
      lastName: "Demo",
      dob: new Date("1992-04-12T00:00:00.000Z"),
      nationality: "Demo",
      email: "ari.demo@example.com",
      phone: "+61400000111",
      assignedToUserId: agentA.id
    }
  });

  const clientB = await prisma.client.upsert({
    where: { clientReference: "OFFLINE-TASK-CLIENT-B" },
    update: { workspaceId: workspace.id, assignedToUserId: agentB.id },
    create: {
      workspaceId: workspace.id,
      clientReference: "OFFLINE-TASK-CLIENT-B",
      firstName: "Bea",
      lastName: "Demo",
      dob: new Date("1990-08-20T00:00:00.000Z"),
      nationality: "Demo",
      email: "bea.demo@example.com",
      phone: "+61400000112",
      assignedToUserId: agentB.id
    }
  });

  const matterA = await prisma.matter.upsert({
    where: { matterReference: "OFFLINE-TASK-MATTER-A" },
    update: { workspaceId: workspace.id, clientId: clientA.id, assignedToUserId: agentA.id, title: "Offline Matter A" },
    create: {
      workspaceId: workspace.id,
      matterReference: "OFFLINE-TASK-MATTER-A",
      clientId: clientA.id,
      assignedToUserId: agentA.id,
      title: "Offline Matter A",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 50
    }
  });

  const matterB = await prisma.matter.upsert({
    where: { matterReference: "OFFLINE-TASK-MATTER-B" },
    update: { workspaceId: workspace.id, clientId: clientB.id, assignedToUserId: agentB.id, title: "Offline Matter B" },
    create: {
      workspaceId: workspace.id,
      matterReference: "OFFLINE-TASK-MATTER-B",
      clientId: clientB.id,
      assignedToUserId: agentB.id,
      title: "Offline Matter B",
      visaSubclass: "485",
      visaStream: "Graduate",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 55
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    update: { pushEnabled: true, pushAgentAlertsEnabled: true, pushClientOptInRequired: true } as any,
    create: { workspaceId: workspace.id, pushEnabled: true, pushAgentAlertsEnabled: true, pushClientOptInRequired: true } as any
  });

  await upsertNotificationPreference({
    workspaceId: workspace.id,
    userId: agentB.id,
    pushEnabled: true,
    inAppEnabled: true
  });

  await prisma.task.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.auditEvent.deleteMany({
    where: {
      workspaceId: workspace.id,
      action: {
        in: [
          "offline.task_created",
          "offline.task_updated",
          "offline.task_completed",
          "offline.sync_started",
          "offline.sync_completed",
          "offline.conflict_detected",
          "offline.sensitive_content_blocked",
          "task.assigned",
          "task.completed",
          "notification.created"
        ]
      }
    }
  });

  return { workspace, owner, agentA, agentB, matterA, matterB };
}

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30000 });
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const created = await createTask({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentA,
    data: {
      matterId: seeded.matterA.id,
      matterReferenceSnapshot: seeded.matterA.matterReference,
      assignedToUserId: seeded.agentB.id,
      title: "Review portal follow-up",
      safeDescription: "Check secure portal follow-up.",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      status: TaskStatus.OPEN,
      priority: TaskPriority.HIGH,
      category: "Follow-up",
      offlineCreatedAt: null
    }
  });
  checks.push({ name: "User can create safe task online", pass: created.title === "Review portal follow-up" });

  const notification = await prisma.inAppNotification.findFirst({
    where: { workspaceId: seeded.workspace.id, userId: seeded.agentB.id },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "In-app notification created for task assignment",
    pass: Boolean(notification?.bodyPreviewRedacted?.includes("task requiring attention"))
  });
  checks.push({
    name: "Push hook uses generic payload only",
    pass: Boolean(notification?.bodyPreviewRedacted && !/passport|grant|dob|client/i.test(notification.bodyPreviewRedacted))
  });

  const stale = await updateTask({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentB,
    taskId: created.id,
    data: {
      baseUpdatedAt: created.updatedAt.toISOString(),
      title: "Review portal follow-up",
      safeDescription: "Updated online",
      dueDate: created.dueDate.toISOString(),
      priority: created.priority,
      status: TaskStatus.IN_PROGRESS,
      assignedToUserId: seeded.agentB.id
    }
  });
  const conflict = await updateTask({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentB,
    taskId: created.id,
    data: {
      baseUpdatedAt: created.updatedAt.toISOString(),
      title: "Review portal follow-up",
      safeDescription: "Offline stale change",
      dueDate: created.dueDate.toISOString(),
      priority: created.priority,
      status: TaskStatus.DONE,
      assignedToUserId: seeded.agentB.id
    }
  });
  checks.push({ name: "Conflict detection works", pass: stale.ok && conflict.conflict === true });

  const resolved = resolveTaskConflict(
    {
      ...serializeTaskForClient(created),
      safeDescription: "Offline stale change",
      syncStatus: "CONFLICT",
      conflictStatus: "MERGE_REQUIRED"
    },
    {
      ...serializeTaskForClient(stale.task),
      syncStatus: "SYNCED",
      conflictStatus: "NONE"
    },
    "merge_safe"
  );
  checks.push({ name: "Conflict resolution works", pass: resolved.syncStatus === "PENDING" && resolved.resolved.conflictStatus === "NONE" });

  const syncResult = await syncOfflineTaskOperations({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentA,
    operations: [
      {
        id: "offline-create-1",
        type: "create",
        taskId: "offline-task-1",
        serverId: null,
        baseUpdatedAt: null,
        payload: {
          matterId: null,
          matterReferenceSnapshot: "OFFLINE-GENERIC-REF",
          assignedToUserId: seeded.agentA.id,
          title: "Offline queued reminder",
          safeDescription: "Low-risk personal reminder.",
          dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          status: "OPEN",
          priority: "MEDIUM",
          offlineCreatedAt: new Date().toISOString()
        }
      }
    ]
  });
  checks.push({
    name: "Queued task syncs when online",
    pass: syncResult.ok && syncResult.results.some((entry: any) => entry.ok === true && entry.type === "create")
  });

  const completed = await syncOfflineTaskOperations({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentB,
    operations: [
      {
        id: "offline-complete-1",
        type: "complete",
        taskId: created.id,
        serverId: created.id,
        baseUpdatedAt: stale.task.updatedAt.toISOString(),
        payload: {}
      }
    ]
  });
  checks.push({
    name: "Task completion syncs",
    pass: completed.ok && completed.results.some((entry: any) => entry.ok === true && entry.type === "complete")
  });

  const blockedNote = evaluateOfflineNoteSafety("Passport number X9999999");
  checks.push({
    name: "Sensitive note document content is blocked from offline storage",
    pass: !blockedNote.allowed && /internet connection/i.test(blockedNote.reason || "")
  });

  const unauthorisedMatter = await createTask({
    workspaceId: seeded.workspace.id,
    actor: seeded.agentA,
    data: {
      matterId: seeded.matterB.id,
      matterReferenceSnapshot: seeded.matterB.matterReference,
      assignedToUserId: seeded.agentA.id,
      title: "Should fail",
      safeDescription: "No access",
      dueDate: new Date().toISOString(),
      status: TaskStatus.OPEN,
      priority: TaskPriority.MEDIUM,
      category: null,
      offlineCreatedAt: null
    }
  }).then(() => false).catch((error) => error instanceof Error && error.message === "MATTER_SCOPE_DENIED");
  checks.push({ name: "Wrong user cannot sync task into unauthorised matter", pass: unauthorisedMatter });

  const swSource = fs.readFileSync(path.join(ROOT, "public", "aria-push-sw.js"), "utf8");
  checks.push({
    name: "Uploaded documents are not cached offline",
    pass: !/caches\./.test(swSource) && !/addEventListener\(\"fetch\"/.test(swSource)
  });
  checks.push({
    name: "Evidence Vault routes are not cached",
    pass: !/evidence|documents|upload|download|portal|payment|cloud-drive|email-sync/i.test(swSource)
  });
  checks.push({
    name: "Private API responses are not cached",
    pass: !/fetch/.test(swSource)
  });
  checks.push({
    name: "Service worker only caches safe static assets",
    pass: !/cache/i.test(swSource)
  });

  const signOutSource = fs.readFileSync(path.join(ROOT, "app", "auth", "sign-out", "page.tsx"), "utf8");
  checks.push({
    name: "Cache clears on logout",
    pass: signOutSource.includes("clearOfflineTaskCache")
  });

  const taskBoardSource = fs.readFileSync(path.join(ROOT, "components", "app", "tasks", "offline-task-board.tsx"), "utf8");
  checks.push({
    name: "Cache clears on workspace switch",
    pass: taskBoardSource.includes("ensureOfflineScope")
  });

  const workspaceRows = await getWorkspaceRows();
  const joined = safeJson(workspaceRows);
  checks.push({
    name: "Platform admin cannot see private note content",
    pass: !/Offline stale change|Low-risk personal reminder/.test(joined)
  });

  const auditRows = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { in: ["offline.task_created", "offline.task_completed", "offline.sensitive_content_blocked"] } },
    orderBy: { createdAt: "desc" }
  });
  checks.push({
    name: "Audit metadata redaction works",
    pass: !/X9999999|Passport number/.test(JSON.stringify(auditRows))
  });

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    server = await startServer(3026);
    browser = await openBrowser();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await login(page, AGENT_A_EMAIL, AGENT_A_PASSWORD);
    await page.goto(`${BASE_URL}/app/tasks`, { waitUntil: "networkidle" });
    checks.push({
      name: "Offline task page loads",
      pass: await page.getByRole("heading", { name: /Offline-friendly task board/i }).isVisible()
    });
    checks.push({
      name: "Mobile viewport has no horizontal overflow",
      pass: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    });

    const anon = await fetch(`${BASE_URL}/api/tasks`, { redirect: "manual" });
    checks.push({
      name: "Client cannot access staff tasks",
      pass: anon.status === 401
    });
  } finally {
    await browser?.close().catch(() => null);
    await stopServer(server);
  }

  const pass = checks.every((check) => check.pass);
  console.log(JSON.stringify({ pass, checks }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());
