import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import {
  AppointmentStatus,
  MatterStage,
  MatterStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { getOrCreateWorkspaceOperationalSettings } from "@/lib/services/workspace-operational-settings";
import { ensureClientPortalToken } from "@/lib/services/client-workflows";
import { syncAppointmentToCalendar } from "@/lib/services/calendar/calendar-sync";
import { upsertWorkspaceProviderConnection, markWorkspaceProviderDisconnected } from "@/lib/services/oauth-token-vault";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "calendar-integration-proof");
const DISABLED_BASE_URL = "http://localhost:3011";
const CONFIGURED_BASE_URL = "http://localhost:3012";
const WORKSPACE_SLUG = "calendar-integration-demo";
const OWNER_EMAIL = "owner.calendar.demo@example.com";
const OWNER_PASSWORD = "Calendar-Demo-Only-2026!";

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
      // Keep polling while the local app starts.
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

async function login(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function openBrowser() {
  return chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true
  });
}

async function createContext(browser: Browser, viewport: { width: number; height: number }) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 1
  });
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("aria-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }, theme);
}

async function seedCalendarDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Calendar Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      legalName: "BrightPath Calendar Demo Pty Ltd",
      contactEmail: "owner.calendar.demo@example.com",
      city: "Sydney",
      state: "NSW",
      country: "Australia",
      timezone: "Australia/Sydney"
    },
    update: {
      name: "BrightPath Calendar Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: "owner.calendar.demo@example.com",
      timezone: "Australia/Sydney"
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Calendar Demo Owner",
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
      name: "Calendar Demo Owner",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent.calendar.demo@example.com" },
    create: {
      workspaceId: workspace.id,
      name: "Sarah Nguyen",
      email: "agent.calendar.demo@example.com",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      name: "Sarah Nguyen",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.SENIOR_MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
      permissionsJson: defaultPermissionsForRole(UserRole.SENIOR_MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "CAL-DEMO-CLIENT-001" },
    create: {
      workspaceId: workspace.id,
      clientReference: "CAL-DEMO-CLIENT-001",
      firstName: "Mia",
      lastName: "Torres",
      email: "mia.torres.demo@example.com",
      phone: "+61 400 000 330",
      dob: new Date("1997-08-14T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: agent.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Mia",
      lastName: "Torres",
      email: "mia.torres.demo@example.com",
      phone: "+61 400 000 330",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "CAL-DEMO-500-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "CAL-DEMO-500-001",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Mia Torres - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 52
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Mia Torres - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 52
    }
  });

  await getOrCreateWorkspaceOperationalSettings(workspace.id);
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId: workspace.id },
    data: {
      appointmentTimezone: "Australia/Sydney",
      appointmentMinNoticeHours: 24,
      appointmentCutoffHours: 6,
      appointmentBufferBeforeMinutes: 15,
      appointmentBufferAfterMinutes: 15,
      appointmentRequestFallback: true,
      appointmentTypesJson: [
        { key: "consultation", label: "Migration consultation", durationMinutes: 45 },
        { key: "document-review", label: "Document review", durationMinutes: 30 }
      ],
      appointmentMeetingMethodsJson: ["Video", "Phone", "In-person"],
      appointmentAvailabilityJson: [
        { weekday: 1, start: "09:00", end: "16:00" },
        { weekday: 2, start: "09:00", end: "16:00" },
        { weekday: 3, start: "11:00", end: "18:00" },
        { weekday: 4, start: "09:00", end: "16:00" },
        { weekday: 5, start: "09:00", end: "15:00" }
      ]
    }
  });

  const existing = await prisma.appointment.findFirst({
    where: {
      workspaceId: workspace.id,
      matterId: matter.id,
      requestedByEmail: client.email
    }
  });
  const appointment = existing
    ? await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          assignedToUserId: agent.id,
          meetingType: "Migration consultation - Video",
          startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: AppointmentStatus.REQUESTED,
          notes: "Dummy calendar integration appointment only. No real client data."
        }
      })
    : await prisma.appointment.create({
        data: {
          workspaceId: workspace.id,
          clientId: client.id,
          matterId: matter.id,
          assignedToUserId: agent.id,
          requestedByName: "Mia Torres",
          requestedByEmail: client.email,
          meetingType: "Migration consultation - Video",
          startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: AppointmentStatus.REQUESTED,
          notes: "Dummy calendar integration appointment only. No real client data."
        }
      });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Calendar integration demo portal",
    createdByUserId: owner.id,
    requestOrigin: DISABLED_BASE_URL
  });

  return { workspace, owner, appointment, portalToken: portal.token };
}

async function prepareDryRunSync(workspaceId: string, userId: string, appointmentId: string) {
  process.env.CALENDAR_PROVIDER = "google";
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "demo-google-calendar-client-id";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "demo-google-calendar-client-secret";
  process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:3012/api/integrations/calendar/callback";

  await upsertWorkspaceProviderConnection({
    workspaceId,
    key: "calendar",
    providerName: "Google Calendar",
    accessToken: "dummy-calendar-access-token",
    refreshToken: "dummy-calendar-refresh-token",
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scopes: ["calendar.events", "calendar.readonly"],
    connectedAccountLabel: "Sandbox dry-run account",
    metadataJson: {
      selectedCalendarId: "primary"
    }
  });

  await syncAppointmentToCalendar({
    workspaceId,
    appointmentId,
    userId,
    dryRun: true
  });

  await markWorkspaceProviderDisconnected({
    workspaceId,
    key: "calendar",
    providerName: "Google Calendar",
    revokeTokens: true,
    lastErrorSummary: null
  });
}

async function setAvailability(workspaceId: string, enabled: boolean) {
  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId },
    data: {
      appointmentAvailabilityJson: enabled
        ? [
            { weekday: 1, start: "09:00", end: "16:00" },
            { weekday: 2, start: "09:00", end: "16:00" },
            { weekday: 3, start: "11:00", end: "18:00" },
            { weekday: 4, start: "09:00", end: "16:00" },
            { weekday: 5, start: "09:00", end: "15:00" }
          ]
        : []
    }
  });
}

async function captureDisabledProof(workspaceId: string, portalToken: string) {
  const server = await startServer(3011, {
    CALENDAR_PROVIDER: "disabled"
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, DISABLED_BASE_URL);
    await setTheme(page, "light");

    await page.goto(`${DISABLED_BASE_URL}/app/settings/integrations/calendar`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "01-calendar-settings-disabled-state.png");

    await page.goto(`${DISABLED_BASE_URL}/app/settings/appointments`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "04-agent-availability-settings.png");

    await setAvailability(workspaceId, true);
    await page.goto(`${DISABLED_BASE_URL}/client/book/${portalToken}`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "05-client-portal-slot-booking.png");

    await setAvailability(workspaceId, false);
    await page.goto(`${DISABLED_BASE_URL}/client/book/${portalToken}`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "06-client-portal-request-fallback.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
    await setAvailability(workspaceId, true);
  }
}

async function captureConfiguredProof() {
  const server = await startServer(3012, {
    CALENDAR_PROVIDER: "google",
    GOOGLE_CALENDAR_CLIENT_ID: "demo-google-calendar-client-id",
    GOOGLE_CALENDAR_CLIENT_SECRET: "demo-google-calendar-client-secret",
    GOOGLE_CALENDAR_REDIRECT_URI: "http://localhost:3012/api/integrations/calendar/callback"
  });
  const browser = await openBrowser();
  let context: BrowserContext | null = null;

  try {
    context = await createContext(browser, { width: 1440, height: 1100 });
    const page = await context.newPage();
    await login(page, CONFIGURED_BASE_URL);
    await setTheme(page, "light");

    await page.goto(`${CONFIGURED_BASE_URL}/app/settings/integrations/calendar`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "02-google-microsoft-provider-setup-state.png");

    const previewCard = page.locator("text=Dry-run safe event preview").locator("..");
    await previewCard.screenshot({ path: path.join(OUTPUT_DIR, "07-dry-run-safe-event-payload-preview.png") });

    await page.goto(`${CONFIGURED_BASE_URL}/app/appointments`, { waitUntil: "networkidle" }).catch(() => null);
    await saveScreenshot(page, "03-appointment-list-calendar-sync-status.png");
    await page.locator("text=Dry-run ready").first().scrollIntoViewIfNeeded().catch(() => null);
    await saveScreenshot(page, "08-appointment-sync-retry-state.png");
  } finally {
    if (context) await context.close();
    await browser.close();
    await stopServer(server);
  }
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const seeded = await seedCalendarDemo();
  await prepareDryRunSync(seeded.workspace.id, seeded.owner.id, seeded.appointment.id);
  await captureDisabledProof(seeded.workspace.id, seeded.portalToken);
  await captureConfiguredProof();

  await prisma.$disconnect();
  console.log(`Saved calendar integration screenshots to ${OUTPUT_DIR}`);
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
