import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { ExtractionStatus, MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureClientPortalToken, generateChecklistForMatter } from "@/lib/services/client-workflows";
import { updateWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { defaultPermissionsForRole } from "@/lib/services/roles";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "mobile-upload-proof");
const BASE_URL = "http://localhost:3022";
const WORKSPACE_SLUG = "mobile-upload-proof-demo";
const AGENT_EMAIL = "mobile-proof-agent@example.com";
const AGENT_PASSWORD = "Mobile-Proof-2026!";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function chromiumExecutable() {
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error("LOCALAPPDATA is not available; cannot locate bundled Chromium.");
  const candidates = [
    path.join(local, "ms-playwright", "chromium-1217", "chrome-win", "chrome.exe"),
    path.join(local, "ms-playwright", "chromium-1217", "chrome-win64", "chrome.exe"),
    path.join(local, "ms-playwright", "chromium_headless_shell-1217", "chrome-win", "headless_shell.exe")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Bundled Chromium not found. Checked: ${candidates.join(", ")}`);
  return found;
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
    await wait(1_000);
  }
  return false;
}

async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", String(port)], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      NEXTAUTH_URL: `http://localhost:${port}`,
      PLATFORM_ADMIN_EMAILS: AGENT_EMAIL
    }
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
  await wait(1_500);
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      slug: WORKSPACE_SLUG,
      name: "BrightPath Mobile Upload Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: AGENT_EMAIL
    },
    update: {
      name: "BrightPath Mobile Upload Demo",
      contactEmail: AGENT_EMAIL
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: AGENT_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Mobile Proof Agent",
      email: AGENT_EMAIL,
      hashedPassword: await hash(AGENT_PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(AGENT_PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "MOBILE-UPLOAD-PROOF-CLIENT" },
    create: {
      workspaceId: workspace.id,
      clientReference: "MOBILE-UPLOAD-PROOF-CLIENT",
      firstName: "Mila",
      lastName: "Tran",
      email: "mila.mobile.demo@example.com",
      phone: "+61400000888",
      dob: new Date("1994-09-09T00:00:00.000Z"),
      nationality: "Demo",
      assignedToUserId: agent.id
    },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "MOBILE-UPLOAD-PROOF-MATTER" },
    create: {
      workspaceId: workspace.id,
      matterReference: "MOBILE-UPLOAD-PROOF-MATTER",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "500 Student Visa",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 46
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "500 Student Visa",
      readinessScore: 46
    }
  });

  const existingDocuments = await prisma.document.findMany({
    where: { matterId: matter.id },
    select: { id: true }
  });
  const existingDocumentIds = existingDocuments.map((document) => document.id);
  await prisma.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.auditEvent.deleteMany({ where: { workspaceId: workspace.id, action: { startsWith: "client_upload." } } });
  await prisma.clientPortalAccessToken.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.checklistItem.updateMany({ where: { matterId: matter.id }, data: { documentId: null } });
  if (existingDocumentIds.length) {
    await prisma.documentStorageObject.deleteMany({ where: { documentId: { in: existingDocumentIds } } });
    await prisma.document.deleteMany({ where: { id: { in: existingDocumentIds } } });
  }
  await prisma.checklistItem.deleteMany({ where: { matterId: matter.id } });

  await generateChecklistForMatter(matter.id, agent.id);
  const items = await prisma.checklistItem.findMany({
    where: { matterId: matter.id },
    orderBy: { label: "asc" }
  });

  await prisma.checklistItem.update({
    where: { id: items[0].id },
    data: {
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    }
  });

  if (items[1]) {
    const flaggedDoc = await prisma.document.create({
      data: {
        workspaceId: workspace.id,
        clientId: client.id,
        matterId: matter.id,
        uploadedByUserId: agent.id,
        fileName: "DEMO - old-passport-scan.pdf",
        storageKey: `demo/mobile-proof/${matter.id}/old-passport-scan.pdf`,
        mimeType: "application/pdf",
        fileSize: 1024,
        category: items[1].category,
        extractionStatus: ExtractionStatus.NEEDS_REVIEW,
        reviewStatus: ReviewStatus.FLAGGED
      }
    });

    await prisma.checklistItem.update({
      where: { id: items[1].id },
      data: {
        documentId: flaggedDoc.id,
        status: "REUPLOAD_REQUESTED",
        requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      }
    });
  }

  await updateWorkspaceLaunchControls(workspace.id, {
    betaModeEnabled: true,
    allowRealClientUploads: true,
    restrictBetaToSelectedUsers: false,
    restrictedUserEmails: [],
    allowedSubclasses: ["500"],
    clientPortalEnabled: true,
    aiDraftAutofillEnabled: true,
    pdfFormFillingEnabled: true,
    exportEnabled: true,
    publicSignupEnabled: false,
    maxFileSizeMb: 8,
    allowedFileTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    legalReviewStatuses: {
      privacy: "draft",
      terms: "draft",
      security: "draft",
      aiDisclaimer: "draft",
      subprocessors: "draft"
    }
  });

  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId: workspace.id },
    data: {
      documentMaxUploadBytes: 8 * 1024 * 1024,
      documentAllowedMimeTypesJson: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    } as any
  });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Mobile upload proof portal",
    createdByUserId: agent.id,
    requestOrigin: "https://aria.test"
  });

  return {
    workspace,
    agent,
    matter,
    token: portal.token
  };
}

async function saveShot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage: true });
}

async function mobileContext(browser: Browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: MOBILE_USER_AGENT,
    isMobile: true,
    deviceScaleFactor: 1
  });
}

async function tabletContext(browser: Browser) {
  return browser.newContext({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(AGENT_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(AGENT_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const seeded = await seedDemo();

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;

  try {
    server = await startServer(3022);
    browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });

    const mobile = await mobileContext(browser);
    const page = await mobile.newPage();

    await page.goto(`${BASE_URL}/client/portal/${seeded.token}`, { waitUntil: "networkidle" });
    await saveShot(page, "01-mobile-client-portal-dashboard.png");

    await page.goto(`${BASE_URL}/client/checklist/${seeded.token}`, { waitUntil: "networkidle" });
    await saveShot(page, "02-mobile-document-checklist.png");

    await page.goto(`${BASE_URL}/client/documents/${seeded.token}`, { waitUntil: "networkidle" });
    await saveShot(page, "03-mobile-upload-card.png");
    await page.getByRole("button", { name: /Take photo/i }).first().scrollIntoViewIfNeeded();
    await saveShot(page, "04-take-photo-choose-file-buttons.png");

    await page.locator('input[type="file"]:not([capture])').first().setInputFiles({
      name: "demo-student-id.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mobile screenshot proof", "utf8")
    });
    await saveShot(page, "05-selected-file-state.png");

    await page.route("**/api/portal/uploads", async (route) => {
      await wait(1500);
      await route.continue();
    }, { times: 1 });
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await wait(300);
    await saveShot(page, "06-upload-progress-state.png");
    await page.waitForSelector("text=Uploaded - waiting for team review", { timeout: 30_000 });
    await saveShot(page, "07-uploaded-success-state.png");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('input[type="file"]:not([capture])').first().setInputFiles({
      name: "demo-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("unsupported", "utf8")
    });
    await saveShot(page, "08-unsupported-file-error.png");

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('input[type="file"]:not([capture])').first().setInputFiles({
      name: "huge.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 1)
    });
    await saveShot(page, "09-too-large-file-error.png");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Re-upload requested").first().scrollIntoViewIfNeeded();
    await saveShot(page, "10-re-upload-state.png");

    await mobile.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('input[type="file"]:not([capture])').first().setInputFiles({
      name: "offline-demo.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 offline demo", "utf8")
    });
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await saveShot(page, "11-offline-warning-state.png");
    await mobile.setOffline(false);
    await mobile.close();

    const appContext = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    const appPage = await appContext.newPage();
    await login(appPage);
    await appPage.goto(`${BASE_URL}/app/settings/notifications`, { waitUntil: "networkidle" });
    await saveShot(appPage, "12-mobile-upload-notification-to-agent.png");
    await appContext.close();

    const tablet = await tabletContext(browser);
    const tabletPage = await tablet.newPage();
    await tabletPage.goto(`${BASE_URL}/client/documents/${seeded.token}`, { waitUntil: "networkidle" });
    await saveShot(tabletPage, "13-tablet-layout.png");
    await tablet.close();
  } finally {
    await browser?.close().catch(() => {});
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
