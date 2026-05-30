import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MatterStage, MatterStatus, SmsConsentStatus, SmsStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { encryptString } from "@/lib/security/encryption";
import { hashPhoneNumber, redactSmsPreview } from "@/lib/services/sms/sms-redaction";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "sms-provider-proof");
const BASE_URL = "http://localhost:3018";
const WORKSPACE_SLUG = "sms-provider-demo";
const OWNER_EMAIL = "owner.sms.demo@example.com";
const OWNER_PASSWORD = "Sms-Demo-2026!";

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
      SMS_PROVIDER: "clicksend",
      CLICKSEND_USERNAME: "",
      CLICKSEND_API_KEY: "",
      CLICKSEND_FROM_NAME: "",
      TWILIO_ACCOUNT_SID: "",
      TWILIO_AUTH_TOKEN: "",
      TWILIO_MESSAGING_SERVICE_SID: "",
      TWILIO_FROM_NUMBER: "",
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

async function login(page: Page) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: { name: "BrightPath SMS Demo", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL },
    update: { name: "BrightPath SMS Demo", plan: WorkspacePlan.PRO, contactEmail: OWNER_EMAIL }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "SMS Demo Owner",
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
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const consentClient = await prisma.client.upsert({
    where: { clientReference: "SMS-DEMO-CLIENT-CONSENT" },
    create: {
      workspaceId: workspace.id,
      clientReference: "SMS-DEMO-CLIENT-CONSENT",
      firstName: "Nora",
      lastName: "Patel",
      email: "nora.sms.demo@example.com",
      phone: "+61400000661",
      dob: new Date("1992-02-04T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: owner.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Nora",
      lastName: "Patel",
      email: "nora.sms.demo@example.com",
      phone: "+61400000661",
      assignedToUserId: owner.id
    }
  });

  const optOutClient = await prisma.client.upsert({
    where: { clientReference: "SMS-DEMO-CLIENT-OPTOUT" },
    create: {
      workspaceId: workspace.id,
      clientReference: "SMS-DEMO-CLIENT-OPTOUT",
      firstName: "Ethan",
      lastName: "Lee",
      email: "ethan.sms.demo@example.com",
      phone: "+61400000662",
      dob: new Date("1990-07-10T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: owner.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Ethan",
      lastName: "Lee",
      email: "ethan.sms.demo@example.com",
      phone: "+61400000662",
      assignedToUserId: owner.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "SMS-DEMO-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "SMS-DEMO-MATTER-001",
      clientId: consentClient.id,
      assignedToUserId: owner.id,
      title: "Nora Patel - SMS Demo Matter",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 52
    },
    update: {
      workspaceId: workspace.id,
      clientId: consentClient.id,
      assignedToUserId: owner.id,
      title: "Nora Patel - SMS Demo Matter",
      readinessScore: 52
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      smsEnabled: true,
      smsClientConsentRequired: true,
      smsAgentAlertsEnabled: true
    },
    update: {
      smsEnabled: true,
      smsClientConsentRequired: true,
      smsAgentAlertsEnabled: true
    }
  });

  await prisma.smsEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsMessage.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsOptOut.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.smsConsent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.auditEvent.deleteMany({ where: { workspaceId: workspace.id, action: { startsWith: "sms." } } });

  await prisma.smsConsent.create({
    data: {
      workspaceId: workspace.id,
      clientId: consentClient.id,
      recordedByUserId: owner.id,
      consentStatus: SmsConsentStatus.CONSENTED,
      source: "demo_seed",
      consentRecordedAt: new Date()
    }
  });

  await prisma.smsConsent.create({
    data: {
      workspaceId: workspace.id,
      clientId: optOutClient.id,
      recordedByUserId: owner.id,
      consentStatus: SmsConsentStatus.OPTED_OUT,
      source: "demo_seed",
      consentRecordedAt: new Date(),
      optOutAt: new Date()
    }
  });

  await prisma.smsOptOut.create({
    data: {
      workspaceId: workspace.id,
      clientId: optOutClient.id,
      recordedByUserId: owner.id,
      reason: "Client opted out in demo seed"
    }
  });

  const smsMessage = await prisma.smsMessage.create({
    data: {
      workspaceId: workspace.id,
      clientId: consentClient.id,
      matterId: matter.id,
      userId: owner.id,
      provider: "clicksend",
      recipientEncrypted: encryptString(consentClient.phone),
      recipientHash: hashPhoneNumber(consentClient.phone),
      recipientLast4: consentClient.phone.slice(-4),
      templateKey: "appointment_reminder",
      messagePreviewRedacted: redactSmsPreview("BrightPath Migration: Reminder, you have an upcoming appointment with your migration team. Please check your secure portal for details."),
      status: SmsStatus.NOT_CONFIGURED,
      lastError: "SMS provider not configured."
    }
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "SmsMessage",
        entityId: smsMessage.id,
        action: "sms.provider_not_configured",
        metadataJson: { provider: "clicksend", reason: "missing configuration", recipient: "***0661" }
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "SmsConsent",
        entityId: consentClient.id,
        action: "sms.consent_recorded",
        metadataJson: { clientId: consentClient.id, consentStatus: "CONSENTED" }
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "SmsConsent",
        entityId: optOutClient.id,
        action: "sms.opted_out",
        metadataJson: { clientId: optOutClient.id, reason: "client_request" }
      }
    ]
  });
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await seedDemo();

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    server = await startServer(3018);
    browser = await openBrowser();
    context = await createContext(browser);
    const page = await context.newPage();
    await login(page);

    await page.goto(`${BASE_URL}/app/settings/integrations/sms`, { waitUntil: "networkidle" });
    await saveScreenshot(page, "01-sms-integration-settings-disabled-not-configured-state.png");
    await page.locator("text=ClickSend recommended/default setup").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "02-clicksend-recommended-default-provider-setup-state.png");
    await page.locator("text=Twilio optional fallback").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "03-twilio-optional-fallback-setup-state.png");
    await page.locator("text=ClickSend recommended/default setup").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "04-dry-run-sms-preview-clicksend.png");
    await page.locator("text=Twilio optional fallback").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "05-dry-run-sms-preview-twilio.png");
    await page.locator("text=Consent status").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "06-sms-consent-status.png");
    await page.locator("text=Opt-out status").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "07-opt-out-status.png");
    await page.locator("text=Test SMS").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "08-test-sms-disabled-configured-state.png");
    await page.locator("text=Appointment reminder").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "09-appointment-reminder-sms-preview.png");
    await page.locator("text=Document reminder").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "10-document-reminder-sms-preview.png");
    await page.locator("text=Provider status").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "11-provider-not-configured-fallback.png");
    await page.locator("text=Redacted audit / event view").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "12-redacted-sms-audit-event-view.png");
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
