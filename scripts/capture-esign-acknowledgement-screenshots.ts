import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { ensureClientPortalToken } from "@/lib/services/client-workflows";
import { createAcknowledgementRequest, submitAcknowledgementByToken } from "@/lib/services/esign/client-acknowledgement";
import { getPortalAcknowledgementRequestByToken } from "@/lib/services/esign/client-acknowledgement";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "esign-acknowledgement-proof");
const INTERNAL_BASE_URL = "http://localhost:3016";
const DOCUSIGN_BASE_URL = "http://localhost:3017";
const WORKSPACE_SLUG = "esign-acknowledgement-demo";
const OWNER_EMAIL = "owner.esign.demo@example.com";
const OWNER_PASSWORD = "Esign-Demo-Only-2026!";

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
      name: "BrightPath Acknowledgement Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      timezone: "Australia/Sydney"
    },
    update: {
      name: "BrightPath Acknowledgement Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      timezone: "Australia/Sydney"
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Esign Demo Owner",
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
      name: "Esign Demo Owner",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent.esign.demo@example.com" },
    create: {
      workspaceId: workspace.id,
      name: "Jaya Singh",
      email: "agent.esign.demo@example.com",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      name: "Jaya Singh",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "ESIGN-DEMO-CLIENT-001" },
    create: {
      workspaceId: workspace.id,
      clientReference: "ESIGN-DEMO-CLIENT-001",
      firstName: "Ava",
      lastName: "Mendoza",
      email: "ava.mendoza.demo@example.com",
      phone: "+61 400 000 550",
      dob: new Date("1994-06-22T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: agent.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Ava",
      lastName: "Mendoza",
      email: "ava.mendoza.demo@example.com",
      phone: "+61 400 000 550",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "ESIGN-DEMO-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "ESIGN-DEMO-MATTER-001",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Ava Mendoza - Partner pathway review",
      visaSubclass: "820/801",
      visaStream: "Partner",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 49
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Ava Mendoza - Partner pathway review",
      readinessScore: 49
    }
  });

  await prisma.esignEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.acknowledgementRecord.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.clientAcknowledgementResponse.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.clientAcknowledgementRequest.deleteMany({ where: { workspaceId: workspace.id } });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Esign demo portal",
    createdByUserId: owner.id,
    requestOrigin: INTERNAL_BASE_URL
  });

  const pending = await createAcknowledgementRequest({
    workspaceId: workspace.id,
    matterId: matter.id,
    requestedByUserId: owner.id,
    requestType: "PERSONAL_DETAILS",
    notifyClient: false
  });

  const submitted = await createAcknowledgementRequest({
    workspaceId: workspace.id,
    matterId: matter.id,
    requestedByUserId: owner.id,
    requestType: "HEALTH_CHARACTER",
    notifyClient: false
  });
  const submittedRequest = await getPortalAcknowledgementRequestByToken(portal.token, submitted.request.id);
  if (submittedRequest) {
    const formData = new FormData();
    formData.set("statementAccepted", "on");
    for (const prompt of submittedRequest.definition?.prompts || []) {
      formData.set(`response__${prompt.key}`, prompt.highImpact ? "needs_agent_follow_up" : "confirmed");
      formData.set(`detail__${prompt.key}`, prompt.highImpact ? "Prior refusal disclosed for agent review." : `Confirmed for ${prompt.title}.`);
    }
    await submitAcknowledgementByToken({
      token: portal.token,
      requestId: submitted.request.id,
      formData,
      clientIp: "127.0.0.1",
      userAgent: "EsignDemo/1.0"
    });
  }

  const revoked = await createAcknowledgementRequest({
    workspaceId: workspace.id,
    matterId: matter.id,
    requestedByUserId: owner.id,
    requestType: "GENERAL_CONFIRMATION",
    notifyClient: false
  });
  await prisma.clientAcknowledgementRequest.update({
    where: { id: revoked.request.id },
    data: { status: "REVOKED", revokedAt: new Date() }
  });

  const expired = await createAcknowledgementRequest({
    workspaceId: workspace.id,
    matterId: matter.id,
    requestedByUserId: owner.id,
    requestType: "DOCUMENT_REQUEST_DETAILS",
    notifyClient: false
  });
  await prisma.clientAcknowledgementRequest.update({
    where: { id: expired.request.id },
    data: { status: "EXPIRED", expiresAt: new Date(Date.now() - 60_000) }
  });

  return {
    matterId: matter.id,
    portalToken: portal.token,
    pendingRequestId: pending.request.id,
    submittedRequestId: submitted.request.id
  };
}

async function captureInternalProof(seed: Awaited<ReturnType<typeof seedDemo>>) {
  const server = await startServer(3016, {
    ESIGN_PROVIDER: "internal_acknowledgement"
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, INTERNAL_BASE_URL);

    await page.goto(`${INTERNAL_BASE_URL}/app/settings/integrations/esign`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "01-esign-integration-settings-internal-state.png");

    await page.goto(`${INTERNAL_BASE_URL}/app/matters/${seed.matterId}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.locator("text=Create client acknowledgement / confirmation").scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "03-create-acknowledgement-request.png");
    await saveScreenshot(page, "04-acknowledgement-preview.png");
    await page.locator("text=Matter acknowledgement requests").scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "08-agent-review-required-response.png");
    await saveScreenshot(page, "09-revoked-expired-state.png");

    await page.goto(`${INTERNAL_BASE_URL}/client/portal/${seed.portalToken}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.locator("text=Client acknowledgement / confirmation").scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "05-client-portal-pending-acknowledgement.png");

    await page.goto(`${INTERNAL_BASE_URL}/client/acknowledgements/token/${seed.portalToken}/${seed.pendingRequestId}`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "06-client-submission-page.png");

    await page.getByRole("button", { name: /submit acknowledgement/i }).click();
    await page.waitForURL(/submitted=1/, { timeout: 15_000 }).catch(() => null);
    await saveScreenshot(page, "07-submitted-acknowledgement-status.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function captureDocusignProof() {
  const server = await startServer(3017, {
    ESIGN_PROVIDER: "docusign",
    DOCUSIGN_INTEGRATION_KEY: "",
    DOCUSIGN_USER_ID: "",
    DOCUSIGN_ACCOUNT_ID: "",
    DOCUSIGN_PRIVATE_KEY: "",
    DOCUSIGN_BASE_URL: "",
    DOCUSIGN_REDIRECT_URI: ""
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, DOCUSIGN_BASE_URL);
    await page.goto(`${DOCUSIGN_BASE_URL}/app/settings/integrations/esign`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "02-docusign-not-configured-state.png");
    const previewCard = page.locator("text=Dry-run external envelope preview").locator("..");
    await previewCard.screenshot({ path: path.join(OUTPUT_DIR, "10-dry-run-external-envelope-preview.png") });
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const seed = await seedDemo();
  await captureInternalProof(seed);
  await captureDocusignProof();
  await prisma.$disconnect();
  console.log(`Saved e-sign acknowledgement screenshots to ${OUTPUT_DIR}`);
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
