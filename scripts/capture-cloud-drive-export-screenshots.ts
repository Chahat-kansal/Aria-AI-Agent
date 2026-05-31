import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { encryptString } from "@/lib/security/encryption";
import { runCloudDriveExport } from "@/lib/services/cloud-drive/cloud-drive-export";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "cloud-drive-export-proof");
const BASE_URL = "http://localhost:3018";
const WORKSPACE_SLUG = "cloud-drive-proof-demo";
const OWNER_EMAIL = "owner.cloud.export.demo@example.com";
const ASSIGNED_EMAIL = "assigned.cloud.export.demo@example.com";
const PASSWORD = "Cloud-Drive-Demo-2026!";

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
      CLOUD_DRIVE_PROVIDER: "disabled",
      GOOGLE_DRIVE_CLIENT_ID: "",
      GOOGLE_DRIVE_CLIENT_SECRET: "",
      GOOGLE_DRIVE_REDIRECT_URI: "",
      MICROSOFT_DRIVE_CLIENT_ID: "",
      MICROSOFT_DRIVE_CLIENT_SECRET: "",
      MICROSOFT_DRIVE_TENANT_ID: "common",
      MICROSOFT_DRIVE_REDIRECT_URI: "",
      PLATFORM_ADMIN_EMAILS: OWNER_EMAIL
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

async function openBrowser() {
  return chromium.launch({ executablePath: chromiumExecutable(), headless: true });
}

async function createContext(browser: Browser) {
  return browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 });
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage });
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: { name: "BrightPath Cloud Export Demo", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    update: { name: "BrightPath Cloud Export Demo", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Cloud Export Owner",
      email: OWNER_EMAIL,
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const assigned = await prisma.user.upsert({
    where: { email: ASSIGNED_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Cloud Export Assigned",
      email: ASSIGNED_EMAIL,
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true },
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: { ...defaultPermissionsForRole(UserRole.MIGRATION_AGENT), can_export_data: true },
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "CLOUD-EXPORT-PROOF-CLIENT" },
    create: {
      workspaceId: workspace.id,
      clientReference: "CLOUD-EXPORT-PROOF-CLIENT",
      firstName: "Mina",
      lastName: "Lopez",
      email: "mina.cloud.export.demo@example.com",
      phone: "+61400000691",
      dob: new Date("1993-01-06T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: assigned.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Mina",
      lastName: "Lopez",
      email: "mina.cloud.export.demo@example.com",
      phone: "+61400000691",
      assignedToUserId: assigned.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "CLOUD-EXPORT-PROOF-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterReference: "CLOUD-EXPORT-PROOF-MATTER-001",
      assignedToUserId: assigned.id,
      title: "Cloud Export Proof Matter",
      visaSubclass: "482",
      visaStream: "Employer Sponsored",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 61
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: assigned.id,
      title: "Cloud Export Proof Matter",
      readinessScore: 61
    }
  });

  const doc = await prisma.document.upsert({
    where: { id: "cme0cloudproofdoc0000000000001" },
    create: {
      id: "cme0cloudproofdoc0000000000001",
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      fileName: "Passport 987654321.pdf",
      storageKey: "private/demo/cloud-proof-passport",
      mimeType: "application/pdf",
      category: "Identity",
      uploadedByUserId: assigned.id,
      extractionStatus: "EXTRACTED",
      reviewStatus: ReviewStatus.VERIFIED
    },
    update: {
      fileName: "Passport 987654321.pdf",
      storageKey: "private/demo/cloud-proof-passport",
      mimeType: "application/pdf",
      category: "Identity"
    }
  });
  await prisma.documentStorageObject.upsert({
    where: { documentId: doc.id },
    create: {
      documentId: doc.id,
      provider: "database",
      storageKey: "private/demo/cloud-proof-passport",
      data: Buffer.from(encryptString("cloud proof bytes"), "utf8")
    },
    update: {
      provider: "database",
      storageKey: "private/demo/cloud-proof-passport",
      data: Buffer.from(encryptString("cloud proof bytes"), "utf8")
    }
  });

  await prisma.generatedDocument.upsert({
    where: { id: "cme0cloudproofgd00000000000001" },
    create: {
      id: "cme0cloudproofgd00000000000001",
      workspaceId: workspace.id,
      matterId: matter.id,
      createdByUserId: assigned.id,
      type: "COVER_LETTER",
      title: "Draft pack summary",
      content: "Dummy draft pack content for screenshot proof."
    },
    update: {
      title: "Draft pack summary",
      content: "Dummy draft pack content for screenshot proof."
    }
  });

  const invoice = await prisma.invoice.upsert({
    where: { workspaceId_invoiceNumber: { workspaceId: workspace.id, invoiceNumber: "INV-CLOUD-PROOF-01" } },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: assigned.id,
      clientName: "Mina Lopez",
      clientEmail: client.email,
      invoiceNumber: "INV-CLOUD-PROOF-01",
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 150000,
      gstCents: 15000,
      totalCents: 165000,
      lineItemsJson: [{ description: "Export proof invoice", quantity: 1, unitPriceCents: 150000, gstRateBps: 1000, isTaxInclusive: false }],
      status: "SENT",
      reviewRequired: true
    },
    update: {
      subtotalCents: 150000,
      gstCents: 15000,
      totalCents: 165000,
      status: "SENT"
    }
  });

  await prisma.cloudDriveEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.cloudDriveExportItem.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.cloudDriveExportJob.deleteMany({ where: { workspaceId: workspace.id } });

  await runCloudDriveExport({
    workspaceId: workspace.id,
    matterId: matter.id,
    user: assigned,
    exportType: "matter_folder",
    dryRun: true
  });
  await runCloudDriveExport({
    workspaceId: workspace.id,
    matterId: matter.id,
    user: assigned,
    exportType: "invoice",
    invoiceId: invoice.id,
    dryRun: true
  });

  return { matter };
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const seeded = await seedDemo();

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  let ownerContext: BrowserContext | null = null;
  try {
    server = await startServer(3018);
    browser = await openBrowser();

    ownerContext = await createContext(browser);
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, OWNER_EMAIL);

    await ownerPage.goto(`${BASE_URL}/app/settings/integrations/cloud-drive`, { waitUntil: "networkidle" });
    await saveScreenshot(ownerPage, "01-cloud-drive-integration-disabled-not-configured-state.png");
    await ownerPage.locator("text=Google Drive").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "02-google-drive-setup-state.png");
    await ownerPage.locator("text=OneDrive").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "03-onedrive-setup-state.png");
    await ownerPage.locator("text=Selected export folder").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "04-selected-export-folder-ui.png");
    await ownerPage.locator("text=Dry-run export manifest preview").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "05-dry-run-export-manifest.png");

    await ownerPage.goto(`${BASE_URL}/app/matters/${seeded.matter.id}`, { waitUntil: "networkidle" });
    await ownerPage.locator("text=Matter cloud export").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "06-matter-export-action-panel.png");
    await ownerPage.locator("text=Export selected documents").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "07-selected-document-export-ui.png");
    await ownerPage.locator("text=Export draft pack").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "08-draft-pack-export-ui.png");
    await ownerPage.locator("text=Export status and retry").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "09-export-history-status.png");
    await saveScreenshot(ownerPage, "10-skipped-files-state.png");
    await ownerPage.locator("text=Local secure ZIP fallback").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "12-local-secure-zip-fallback-state.png");

    const blockedPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await blockedPage.goto(`${BASE_URL}/api/settings/data/export-folder?matterId=${seeded.matter.id}`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(blockedPage, "11-unauthorised-export-blocked-state.png");
    await blockedPage.close();
  } finally {
    await ownerContext?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
