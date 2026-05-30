import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { recordWorkspaceProviderActivity, upsertWorkspaceProviderConnection } from "@/lib/services/oauth-token-vault";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "email-sync-proof");
const DISABLED_BASE_URL = "http://localhost:3013";
const GMAIL_BASE_URL = "http://localhost:3014";
const MICROSOFT_BASE_URL = "http://localhost:3015";
const WORKSPACE_SLUG = "email-sync-demo";
const OWNER_EMAIL = "owner.email.sync.demo@example.com";
const OWNER_PASSWORD = "Email-Sync-Demo-2026!";

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
    } catch {
      // keep polling
    }
    await wait(1_000);
  }
  return false;
}

async function startServer(port: number, extraEnv: Record<string, string>): Promise<ChildProcess> {
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", String(port)], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      ...extraEnv
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
  return chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true
  });
}

async function createContext(browser: Browser, viewport: { width: number; height: number }) {
  return browser.newContext({ viewport, deviceScaleFactor: 1 });
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage });
}

async function login(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Email Sync Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      timezone: "Australia/Sydney"
    },
    update: {
      name: "BrightPath Email Sync Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      timezone: "Australia/Sydney"
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Email Sync Demo Owner",
      email: OWNER_EMAIL,
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      name: "Email Sync Demo Owner",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent.email.sync.demo@example.com" },
    create: {
      workspaceId: workspace.id,
      name: "Lina Rao",
      email: "agent.email.sync.demo@example.com",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      name: "Lina Rao",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "EMAIL-DEMO-CLIENT-001" },
    create: {
      workspaceId: workspace.id,
      clientReference: "EMAIL-DEMO-CLIENT-001",
      firstName: "Nina",
      lastName: "Patel",
      email: "nina.patel.demo@example.com",
      phone: "+61 400 000 440",
      dob: new Date("1995-03-12T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: agent.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Nina",
      lastName: "Patel",
      email: "nina.patel.demo@example.com",
      phone: "+61 400 000 440",
      assignedToUserId: agent.id
    }
  });

  const emptyMatter = await prisma.matter.upsert({
    where: { matterReference: "EMAIL-DEMO-EMPTY-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "EMAIL-DEMO-EMPTY-001",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Nina Patel - Empty Email Timeline",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 47
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Nina Patel - Empty Email Timeline",
      readinessScore: 47
    }
  });

  const linkedMatter = await prisma.matter.upsert({
    where: { matterReference: "EMAIL-DEMO-LINKED-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "EMAIL-DEMO-LINKED-001",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Nina Patel - Linked Email Timeline",
      visaSubclass: "482",
      visaStream: "Employer Sponsored",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 58
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Nina Patel - Linked Email Timeline",
      readinessScore: 58
    }
  });

  await prisma.matterEmailMessage.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.matterEmailThread.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.emailSyncEvent.deleteMany({ where: { workspaceId: workspace.id } });

  const linkedThread = await prisma.matterEmailThread.create({
    data: {
      workspaceId: workspace.id,
      matterId: linkedMatter.id,
      linkedByUserId: owner.id,
      provider: "gmail",
      externalThreadId: "demo-linked-thread",
      externalMessageId: "demo-linked-message",
      subjectPreview: "Secure portal follow-up",
      fromMetadataJson: { address: "client@example.com" },
      toMetadataJson: ["agent@example.com"],
      messageCount: 2,
      lastMessageAt: new Date(),
      syncStatus: "LINKED",
      lastSyncAt: new Date()
    }
  });

  await prisma.matterEmailMessage.create({
    data: {
      workspaceId: workspace.id,
      matterId: linkedMatter.id,
      threadId: linkedThread.id,
      externalMessageId: "demo-linked-message",
      direction: "inbound",
      senderLabel: "client@example.com",
      recipientLabelsJson: ["agent@example.com"],
      sentAt: new Date(),
      subjectPreview: "Secure portal follow-up",
      bodyImported: true,
      bodyPreview: "Metadata-only preview. Please review the secure portal for matter details."
    }
  });

  return { workspace, owner, emptyMatter, linkedMatter };
}

async function prepareProviderConnection(workspaceId: string, providerName: "gmail" | "microsoft", errorSummary?: string | null) {
  await upsertWorkspaceProviderConnection({
    workspaceId,
    key: "email_sync",
    providerName,
    accessToken: `dummy-${providerName}-access-token`,
    refreshToken: `dummy-${providerName}-refresh-token`,
    scopes: providerName === "gmail" ? ["gmail.send", "gmail.metadata"] : ["Mail.Send", "Mail.ReadBasic"],
    connectedAccountLabel: providerName === "gmail" ? "Sandbox Gmail mailbox" : "Sandbox Outlook mailbox",
    lastSuccessfulActionAt: new Date()
  });

  if (errorSummary) {
    await recordWorkspaceProviderActivity({
      workspaceId,
      key: "email_sync",
      providerName,
      lastErrorSummary: errorSummary,
      connectionState: "attention_required"
    });
  }
}

async function captureDisabledProof(emptyMatterId: string, linkedMatterId: string) {
  const server = await startServer(3013, { EMAIL_SYNC_PROVIDER: "disabled" });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, DISABLED_BASE_URL);

    await page.goto(`${DISABLED_BASE_URL}/app/settings/integrations/email-sync`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "01-integrations-email-sync-settings-disabled-state.png");

    await page.goto(`${DISABLED_BASE_URL}/app/matters/${emptyMatterId}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.locator("text=Matter email workspace").scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "05-matter-email-timeline-empty-state.png");

    await page.goto(`${DISABLED_BASE_URL}/app/matters/${linkedMatterId}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.getByRole("button", { name: /send client email/i }).click();
    await page.getByRole("button", { name: /review and send/i }).click();
    await page.locator("text=Manual fallback").waitFor({ timeout: 15_000 }).catch(() => null);
    await saveScreenshot(page, "08-manual-fallback-state.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function captureGmailProof(linkedMatterId: string) {
  const server = await startServer(3014, {
    EMAIL_SYNC_PROVIDER: "gmail",
    GMAIL_CLIENT_ID: "demo-gmail-client-id",
    GMAIL_CLIENT_SECRET: "demo-gmail-client-secret",
    GMAIL_REDIRECT_URI: "http://localhost:3014/api/integrations/email-sync/callback"
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, GMAIL_BASE_URL);

    await page.goto(`${GMAIL_BASE_URL}/app/settings/integrations/email-sync`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "02-gmail-provider-setup-state.png");

    const previewCard = page.locator("text=Safe dry-run email payload preview").locator("..");
    await previewCard.screenshot({ path: path.join(OUTPUT_DIR, "04-safe-dry-run-email-payload-preview.png") });

    await saveScreenshot(page, "09-redacted-sync-error-state.png");

    await page.goto(`${GMAIL_BASE_URL}/app/matters/${linkedMatterId}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.locator("text=Matter email workspace").scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "06-linked-email-thread-metadata-state.png");

    await page.getByRole("button", { name: /send client email/i }).click();
    await page.locator("text=Mailbox send with review").waitFor({ timeout: 15_000 }).catch(() => null);
    await saveScreenshot(page, "07-send-client-email-modal.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function captureMicrosoftProof() {
  const server = await startServer(3015, {
    EMAIL_SYNC_PROVIDER: "microsoft",
    MICROSOFT_EMAIL_CLIENT_ID: "demo-microsoft-email-client-id",
    MICROSOFT_EMAIL_CLIENT_SECRET: "demo-microsoft-email-client-secret",
    MICROSOFT_EMAIL_TENANT_ID: "common",
    MICROSOFT_EMAIL_REDIRECT_URI: "http://localhost:3015/api/integrations/email-sync/callback"
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, MICROSOFT_BASE_URL);
    await page.goto(`${MICROSOFT_BASE_URL}/app/settings/integrations/email-sync`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "03-microsoft-provider-setup-state.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const seeded = await seedDemo();
  await prepareProviderConnection(seeded.workspace.id, "gmail", "Provider error summary redacted. Reconnect mailbox to continue.");
  await captureDisabledProof(seeded.emptyMatter.id, seeded.linkedMatter.id);
  await captureGmailProof(seeded.linkedMatter.id);
  await prepareProviderConnection(seeded.workspace.id, "microsoft");
  await captureMicrosoftProof();

  await prisma.$disconnect();
  console.log(`Saved email sync screenshots to ${OUTPUT_DIR}`);
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
