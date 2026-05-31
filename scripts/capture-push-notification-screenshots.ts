import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { MatterStage, MatterStatus, PushConsentStatus, PushStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { encryptString } from "@/lib/security/encryption";
import { sha256Hex } from "@/lib/security/hash";
import { getEndpointLast8, hashEndpoint } from "@/lib/services/push/push-redaction";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "push-notification-proof");
const BASE_URL = "http://localhost:3018";
const WORKSPACE_SLUG = "push-notification-proof-demo";
const OWNER_EMAIL = "owner.push.demo@example.com";
const OWNER_PASSWORD = "Push-Demo-2026!";

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

async function startServer(port: number, overrides: Record<string, string>): Promise<ChildProcess> {
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", String(port)], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      NEXTAUTH_URL: `http://localhost:${port}`,
      PLATFORM_ADMIN_EMAILS: OWNER_EMAIL,
      ...overrides
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
    create: {
      slug: WORKSPACE_SLUG,
      name: "BrightPath Push Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL
    },
    update: {
      name: "BrightPath Push Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Push Demo Owner",
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

  const client = await prisma.client.upsert({
    where: { clientReference: "PUSH-PROOF-CLIENT-001" },
    create: {
      workspaceId: workspace.id,
      clientReference: "PUSH-PROOF-CLIENT-001",
      firstName: "Nina",
      lastName: "Park",
      email: "nina.push.demo@example.com",
      phone: "+61400000741",
      dob: new Date("1991-02-14T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: owner.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Nina",
      lastName: "Park",
      email: "nina.push.demo@example.com",
      phone: "+61400000741",
      assignedToUserId: owner.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "PUSH-PROOF-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "PUSH-PROOF-MATTER-001",
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Push Proof Matter",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 57
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Push Proof Matter",
      readinessScore: 57
    }
  });

  await prisma.workspaceOperationalSettings.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    },
    update: {
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    }
  });

  await prisma.pushEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.notificationPreference.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.pushSubscription.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.auditEvent.deleteMany({
    where: {
      workspaceId: workspace.id,
      action: {
        in: [
          "push.provider_tested",
          "push.device_registered",
          "push.device_unregistered",
          "push.sent",
          "push.failed",
          "push.template_sent",
          "push.blocked_no_consent",
          "push.blocked_rate_limited",
          "push.opted_out",
          "push.consent_recorded",
          "push.provider_not_configured",
          "notification.created",
          "notification.read",
          "notification.read_all"
        ]
      }
    }
  });

  await prisma.notificationPreference.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      pushEnabled: true,
      inAppEnabled: true,
      emailFallbackEnabled: true
    }
  });

  const primaryEndpoint = "https://push.example.test/subscriptions/proof-device-001";
  const optOutEndpoint = "https://push.example.test/subscriptions/proof-device-002";

  await prisma.pushSubscription.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: owner.id,
        clientId: client.id,
        provider: "web_push",
        deviceId: "proof-device-001",
        endpointEncrypted: encryptString(primaryEndpoint),
        endpointHash: hashEndpoint(primaryEndpoint),
        endpointLast8: getEndpointLast8(primaryEndpoint),
        subscriptionEncrypted: encryptString(JSON.stringify({
          endpoint: primaryEndpoint,
          expirationTime: null,
          keys: { p256dh: "demo-primary-key", auth: "demo-primary-auth" }
        })),
        userAgentHash: sha256Hex("Push proof primary browser"),
        platform: "Windows browser",
        consentStatus: PushConsentStatus.OPTED_IN
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        clientId: client.id,
        provider: "web_push",
        deviceId: "proof-device-002",
        endpointEncrypted: encryptString(optOutEndpoint),
        endpointHash: hashEndpoint(optOutEndpoint),
        endpointLast8: getEndpointLast8(optOutEndpoint),
        subscriptionEncrypted: encryptString(JSON.stringify({
          endpoint: optOutEndpoint,
          expirationTime: null,
          keys: { p256dh: "demo-optout-key", auth: "demo-optout-auth" }
        })),
        userAgentHash: sha256Hex("Push proof opt-out browser"),
        platform: "Android browser",
        consentStatus: PushConsentStatus.OPTED_IN
      }
    ]
  });

  const unread = await prisma.inAppNotification.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      clientId: client.id,
      matterId: matter.id,
      eventType: "document_uploaded",
      title: "Aria",
      bodyPreviewRedacted: "Aria: A client uploaded a document. Open Aria to review.",
      route: "/app/overview"
    }
  });

  await prisma.inAppNotification.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      clientId: client.id,
      matterId: matter.id,
      eventType: "appointment_reminder",
      title: "Aria",
      bodyPreviewRedacted: "Aria: You have an upcoming appointment. Open Aria for details.",
      route: "/app/appointments",
      isRead: true,
      readAt: new Date()
    }
  });

  await prisma.pushEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: owner.id,
        eventType: "push.template_sent",
        status: PushStatus.DRY_RUN,
        summary: "Dry-run preview recorded",
        metadataJson: { provider: "web_push", route: "/app/overview", endpoint: "***e-001" }
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        inAppNotificationId: unread.id,
        eventType: "push.provider_not_configured",
        status: PushStatus.IN_APP_ONLY,
        summary: "Push notifications not enabled on a device. In-app fallback created.",
        metadataJson: { provider: "disabled", route: "/app/overview" }
      }
    ]
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "PushSubscription",
        entityId: "proof-device-001",
        action: "push.device_registered",
        metadataJson: { provider: "web_push", endpoint: "***e-001", platform: "Windows browser" }
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "PushSubscription",
        entityId: "proof-device-002",
        action: "push.opted_out",
        metadataJson: { provider: "web_push", endpoint: "***e-002", reason: "client_request" }
      },
      {
        workspaceId: workspace.id,
        userId: owner.id,
        entityType: "InAppNotification",
        entityId: unread.id,
        action: "notification.created",
        metadataJson: { eventType: "document_uploaded", route: "/app/overview" }
      }
    ]
  });

  return { workspace, owner, client, matter };
}

async function setPushEnabled(workspaceId: string, userId: string, enabled: boolean) {
  await prisma.notificationPreference.updateMany({
    where: { workspaceId, userId },
    data: { pushEnabled: enabled }
  });
}

async function setOptOut(workspaceId: string, userId: string, deviceId: string) {
  await prisma.pushSubscription.updateMany({
    where: { workspaceId, userId, deviceId },
    data: { consentStatus: PushConsentStatus.OPTED_OUT, optOutAt: new Date() }
  });
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  const seeded = await seedDemo();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let disabledServer: ChildProcess | null = null;
  let configuredServer: ChildProcess | null = null;

  try {
    disabledServer = await startServer(3018, {
      PUSH_PROVIDER: "disabled",
      NEXT_PUBLIC_PUSH_PROVIDER: "disabled",
      WEB_PUSH_VAPID_PUBLIC_KEY: "",
      WEB_PUSH_VAPID_PRIVATE_KEY: "",
      WEB_PUSH_CONTACT_EMAIL: "",
      NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "",
      FCM_PROJECT_ID: "",
      FCM_CLIENT_EMAIL: "",
      FCM_PRIVATE_KEY: ""
    });

    browser = await openBrowser();
    context = await createContext(browser);
    const disabledPage = await context.newPage();
    await login(disabledPage);
    await disabledPage.goto(`${BASE_URL}/app/settings/integrations/push`, { waitUntil: "networkidle" });
    await saveScreenshot(disabledPage, "01-push-integration-settings-disabled-not-configured-state.png");
    await context.close();
    await browser.close();
    await stopServer(disabledServer);

    browser = await openBrowser();
    context = await createContext(browser);
    configuredServer = await startServer(3018, {
      PUSH_PROVIDER: "web_push",
      NEXT_PUBLIC_PUSH_PROVIDER: "web_push",
      WEB_PUSH_VAPID_PUBLIC_KEY: "BElocalPushVapidPublicKeyDemo1234567890",
      WEB_PUSH_VAPID_PRIVATE_KEY: "phase9-demo-web-push-private-key",
      WEB_PUSH_CONTACT_EMAIL: "ops@example.com",
      NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: "BElocalPushVapidPublicKeyDemo1234567890",
      FCM_PROJECT_ID: "demo-fcm-project",
      FCM_CLIENT_EMAIL: "firebase-adminsdk@example.iam.gserviceaccount.com",
      FCM_PRIVATE_KEY: "phase9-demo-fcm-private-key"
    });

    const page = await context.newPage();
    await login(page);

    await page.goto(`${BASE_URL}/app/settings/integrations/push`, { waitUntil: "networkidle" });
    await page.locator("text=Web Push setup state").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "02-web-push-setup-state.png");
    await page.locator("text=FCM setup state").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "03-fcm-setup-state.png");
    await page.locator("text=Web Push setup state").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "04-dry-run-push-payload-preview.png");

    await page.goto(`${BASE_URL}/app/settings/notifications`, { waitUntil: "networkidle" });
    await page.locator("text=Notification preferences").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "05-notification-preferences.png");
    await page.locator("text=Device registration status").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "06-device-registration-state.png");
    await page.locator("text=In-app notification centre").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "07-in-app-notification-centre.png");
    await saveScreenshot(page, "08-unread-notification-state.png");

    await setPushEnabled(seeded.workspace.id, seeded.owner.id, false);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("text=Push notifications not enabled").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "09-push-consent-missing-state.png");

    await setPushEnabled(seeded.workspace.id, seeded.owner.id, true);
    await setOptOut(seeded.workspace.id, seeded.owner.id, "proof-device-002");
    await page.goto(`${BASE_URL}/app/settings/integrations/push`, { waitUntil: "networkidle" });
    await page.locator("text=Registered devices").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "10-opt-out-state.png");

    await page.locator("text=Provider status").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "11-test-push-configured-state.png");
    await page.locator("text=Redacted push audit / event view").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "12-redacted-push-audit-event-view.png");
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopServer(disabledServer);
    await stopServer(configuredServer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
