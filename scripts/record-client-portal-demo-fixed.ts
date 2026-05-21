import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { hash } from "bcryptjs";
import { chromium, type Locator, type Page } from "playwright-core";
import {
  AppointmentStatus,
  ExtractionStatus,
  MatterStage,
  MatterStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { addMatterTimelineEvent, ensureClientPortalToken } from "../lib/services/client-workflows";

const execFile = promisify(execFileCb);
const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3007";
const DEMO_DIR = path.join(ROOT, "docs", "demo");
const VIDEO_TEMP_DIR = path.join(DEMO_DIR, ".portal-fixed-video-temp");
const SCREENSHOT_DIR = path.join(DEMO_DIR, "portal-fixed-screenshots");
const VIDEO_PATH = path.join(DEMO_DIR, "aria-client-portal-demo-fixed.mp4");
const SCRIPT_PATH = path.join(DEMO_DIR, "aria-client-portal-demo-fixed-script.md");
const DUMMY_DOC_DIR = path.join(DEMO_DIR, "dummy-documents");
const DUMMY_DOC_PATH = path.join(DUMMY_DOC_DIR, "DEMO-DOCUMENT-NOT-REAL-CLIENT-DATA-portal-upload.pdf");
const PASSWORD = "BrightPath-Demo-Only-2026!";
const WORKSPACE_SLUG = "brightpath-migration-demo";

type Seed = { portalUrl: string };

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function nextDateInput(days: number) {
  return addDays(days).toISOString().slice(0, 10);
}

function chromiumExecutable() {
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error("LOCALAPPDATA is not available.");
  const candidates = [
    path.join(local, "ms-playwright", "chromium-1217", "chrome-win", "chrome.exe"),
    path.join(local, "ms-playwright", "chromium-1217", "chrome-win64", "chrome.exe"),
    path.join(local, "ms-playwright", "chromium_headless_shell-1217", "chrome-win", "headless_shell.exe")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Bundled Chromium not found. Checked: ${candidates.join(", ")}`);
  return found;
}

function ffmpegExecutable() {
  try {
    const installed = require("@ffmpeg-installer/ffmpeg") as { path?: string };
    if (installed.path && existsSync(installed.path)) return installed.path;
  } catch {
    // Fall back below.
  }
  const local = process.env.LOCALAPPDATA;
  if (!local) return null;
  const candidate = path.join(local, "ms-playwright", "ffmpeg-1011", "ffmpeg-win64.exe");
  return existsSync(candidate) ? candidate : null;
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
      // Keep waiting.
    }
    await wait(1_000);
  }
  return false;
}

async function ensureLocalServer() {
  if (await waitForApp(BASE_URL, 3_000)) return null;
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", "3007"], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true
  });
  if (!(await waitForApp(BASE_URL))) {
    child.kill();
    throw new Error(`Local app did not become available at ${BASE_URL}`);
  }
  return child;
}

async function ensureDummyPdf() {
  await mkdir(DUMMY_DOC_DIR, { recursive: true });
  await writeFile(DUMMY_DOC_PATH, "%PDF-1.4\n% DEMO DOCUMENT - NOT REAL CLIENT DATA\n", "utf8");
}

async function upsertUser(workspaceId: string, email: string, name: string, role: UserRole, scope: UserVisibilityScope = UserVisibilityScope.FIRM_WIDE) {
  return prisma.user.upsert({
    where: { email },
    create: {
      workspaceId,
      email,
      name,
      role,
      status: UserStatus.ACTIVE,
      hashedPassword: await hash(PASSWORD, 12),
      visibilityScope: scope,
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId,
      name,
      role,
      status: UserStatus.ACTIVE,
      hashedPassword: await hash(PASSWORD, 12),
      visibilityScope: scope,
      inviteAcceptedAt: new Date()
    }
  });
}

async function createDemoDocument(input: {
  workspaceId: string;
  clientId: string;
  matterId: string;
  uploadedByUserId: string;
  fileName: string;
  category: string;
  reviewStatus: ReviewStatus;
  extractionStatus: ExtractionStatus;
}) {
  const storageKey = `demo/portal-fixed/${input.matterId}/${input.fileName}`;
  const existing = await prisma.document.findFirst({ where: { workspaceId: input.workspaceId, storageKey } });
  const data = {
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    matterId: input.matterId,
    uploadedByUserId: input.uploadedByUserId,
    fileName: input.fileName,
    storageKey,
    mimeType: "application/pdf",
    fileSize: 2048,
    category: input.category,
    extractionStatus: input.extractionStatus,
    reviewStatus: input.reviewStatus
  };
  return existing ? prisma.document.update({ where: { id: existing.id }, data }) : prisma.document.create({ data });
}

async function seedPortalDemo(): Promise<Seed> {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Migration Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      legalName: "BrightPath Migration Demo Pty Ltd",
      contactEmail: "owner@brightpath-demo.com",
      timezone: "Australia/Sydney"
    },
    update: { name: "BrightPath Migration Demo", plan: WorkspacePlan.PRO }
  });
  const owner = await upsertUser(workspace.id, "owner@brightpath-demo.com", "Olivia Bright", UserRole.COMPANY_OWNER);
  const sarah = await upsertUser(workspace.id, "agent.sarah@brightpath-demo.com", "Sarah Nguyen", UserRole.SENIOR_MIGRATION_AGENT, UserVisibilityScope.TEAM_OVERSIGHT);

  const client = await prisma.client.upsert({
    where: { clientReference: "DEMO-NOAH-PORTAL" },
    create: {
      workspaceId: workspace.id,
      clientReference: "DEMO-NOAH-PORTAL",
      firstName: "Noah",
      lastName: "Rivera",
      email: "client.noah.portal@brightpath-demo.com",
      phone: "+61 400 000 220",
      dob: new Date("1999-04-18T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: sarah.id,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Noah",
      lastName: "Rivera",
      email: "client.noah.portal@brightpath-demo.com",
      assignedToUserId: sarah.id,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "DEMO-NOAH-PORTAL-500" },
    create: {
      workspaceId: workspace.id,
      matterReference: "DEMO-NOAH-PORTAL-500",
      clientId: client.id,
      assignedToUserId: sarah.id,
      title: "Noah Rivera - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.AWAITING_DOCS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 46,
      lodgementTargetDate: addDays(45),
      expectedNextMilestone: "Review uploaded evidence and confirm missing documents"
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: sarah.id,
      title: "Noah Rivera - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.AWAITING_DOCS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 46
    }
  });

  await prisma.checklistItem.deleteMany({ where: { matterId: matter.id } });
  const passport = await createDemoDocument({ workspaceId: workspace.id, clientId: client.id, matterId: matter.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - NOT REAL CLIENT DATA - passport.pdf", category: "Identity", reviewStatus: ReviewStatus.VERIFIED, extractionStatus: ExtractionStatus.EXTRACTED });
  const blurry = await createDemoDocument({ workspaceId: workspace.id, clientId: client.id, matterId: matter.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - NOT REAL CLIENT DATA - blurry bank statement.pdf", category: "Financial", reviewStatus: ReviewStatus.FLAGGED, extractionStatus: ExtractionStatus.NEEDS_REVIEW });
  await prisma.checklistItem.createMany({
    data: [
      { matterId: matter.id, documentId: passport.id, itemKey: "passport", category: "Identity", label: "Passport bio page", description: "Current passport biodata page.", status: "APPROVED", required: true, dueDate: addDays(2), requestedAt: new Date(), reviewedAt: new Date() },
      { matterId: matter.id, documentId: blurry.id, itemKey: "funds", category: "Financial", label: "Financial capacity evidence", description: "Bank statement or other funds evidence.", status: "REUPLOAD_REQUESTED", required: true, dueDate: addDays(3), requestedAt: new Date() },
      { matterId: matter.id, itemKey: "coe", category: "Education", label: "Confirmation of Enrolment", description: "Course enrolment evidence from the provider.", status: "REQUESTED", required: true, dueDate: addDays(4), requestedAt: new Date() },
      { matterId: matter.id, itemKey: "oshc", category: "Health / Insurance", label: "OSHC / health insurance", description: "Health insurance evidence for the study period.", status: "REQUESTED", required: true, dueDate: addDays(5), requestedAt: new Date() },
      { matterId: matter.id, itemKey: "genuine_student", category: "Statements", label: "Genuine student statement", description: "Statement and supporting evidence for agent review.", status: "MISSING", required: true, dueDate: addDays(7), requestedAt: new Date() },
      { matterId: matter.id, itemKey: "english", category: "Education", label: "English evidence", description: "PTE, IELTS, or exemption evidence if relevant.", status: "OPTIONAL", required: false, dueDate: addDays(9), requestedAt: new Date() }
    ]
  });

  await prisma.appointment.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      assignedToUserId: sarah.id,
      requestedByName: "Noah Rivera",
      requestedByEmail: "client.noah.portal@brightpath-demo.com",
      meetingType: "Evidence review · Video call",
      startsAt: addDays(6),
      status: AppointmentStatus.REQUESTED,
      notes: "DEMO appointment request - not real client data"
    }
  });

  await addMatterTimelineEvent({ workspaceId: workspace.id, matterId: matter.id, actorUserId: owner.id, eventType: "documents.requested", title: "Documents requested", description: "Your migration team requested missing documents." });
  await addMatterTimelineEvent({ workspaceId: workspace.id, matterId: matter.id, actorUserId: sarah.id, eventType: "documents.reminder_sent", title: "Reminder from migration team", description: "Please upload the COE and OSHC certificate when ready." });
  await addMatterTimelineEvent({ workspaceId: workspace.id, matterId: matter.id, actorUserId: sarah.id, eventType: "portal.client_message", title: "Client message received", description: "DEMO client message: I will upload the COE today." });
  await addMatterTimelineEvent({ workspaceId: workspace.id, matterId: matter.id, actorUserId: sarah.id, eventType: "portal.client_acknowledgement", title: "Client acknowledgement / confirmation recorded", description: "Portal information acknowledgement. Registered migration agent review required before use." });
  await addMatterTimelineEvent({ workspaceId: workspace.id, matterId: matter.id, actorUserId: sarah.id, eventType: "appointment.requested", title: "Appointment requested", description: "Evidence review requested for demo matter." });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Noah fixed portal demo",
    createdByUserId: sarah.id,
    requestOrigin: BASE_URL
  });

  return { portalUrl: portal.url };
}

async function addOverlay(page: Page, label: string) {
  await page.evaluate((text) => {
    document.querySelector("[data-portal-demo-banner]")?.remove();
    const banner = document.createElement("div");
    banner.setAttribute("data-portal-demo-banner", "true");
    banner.textContent = `FIXED CLIENT PORTAL DEMO - DUMMY DATA ONLY - ${text}`;
    Object.assign(banner.style, {
      position: "fixed",
      zIndex: "2147483647",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      borderRadius: "999px",
      background: "rgba(15,23,42,0.94)",
      color: "white",
      font: "700 13px system-ui",
      boxShadow: "0 16px 44px rgba(0,0,0,0.28)",
      pointerEvents: "none"
    });
    document.body.appendChild(banner);
  }, label).catch(() => null);
}

async function goto(page: Page, url: string, label: string, screenshotName: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
  await addOverlay(page, label);
  await wait(1_000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${screenshotName}.png`), fullPage: false });
}

async function fill(page: Page, locator: Locator, value: string) {
  await locator.click({ timeout: 12_000 });
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 35 });
  await wait(350);
}

async function convertVideo() {
  const files = await readdir(VIDEO_TEMP_DIR);
  const webm = files.find((file) => file.endsWith(".webm"));
  if (!webm) throw new Error("No Playwright webm recording was produced.");
  const source = path.join(VIDEO_TEMP_DIR, webm);
  const ffmpeg = ffmpegExecutable();
  if (!ffmpeg) {
    const webmPath = VIDEO_PATH.replace(/\.mp4$/, ".webm");
    await rename(source, webmPath);
    return webmPath;
  }
  await rm(VIDEO_PATH, { force: true }).catch(() => null);
  await execFile(ffmpeg, ["-y", "-i", source, "-movflags", "+faststart", "-pix_fmt", "yuv420p", VIDEO_PATH], { cwd: ROOT });
  return VIDEO_PATH;
}

async function videoDuration() {
  const ffmpeg = ffmpegExecutable();
  if (!ffmpeg || !existsSync(VIDEO_PATH)) return "unknown";
  const result = await execFile(ffmpeg, ["-i", VIDEO_PATH], { cwd: ROOT }).catch((error: any) => error);
  const text = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  return text.match(/Duration:\s*([0-9:.]+)/)?.[1] ?? "unknown";
}

async function main() {
  await mkdir(DEMO_DIR, { recursive: true });
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await rm(VIDEO_TEMP_DIR, { recursive: true, force: true }).catch(() => null);
  await mkdir(VIDEO_TEMP_DIR, { recursive: true });
  await ensureDummyPdf();
  const seed = await seedPortalDemo();
  const server: ChildProcess | null = await ensureLocalServer();
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const page = await context.newPage();
  try {
    await goto(page, seed.portalUrl, "Portal home dashboard", "01-portal-home");
    await page.mouse.wheel(0, 760);
    await wait(1_000);
    await goto(page, seed.portalUrl.replace("/client/portal/", "/client/documents/"), "Document checklist and upload", "02-documents");
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(DUMMY_DOC_PATH);
      await wait(700);
      await page.locator('input[name="consent"]').first().check();
      await wait(500);
      await page.getByRole("button", { name: /upload document/i }).first().click();
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
      await addOverlay(page, "Upload success state");
      await wait(1_200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-upload-success.png"), fullPage: false });
    }
    await goto(page, `${seed.portalUrl}#messages`, "Message thread", "04-messages");
    await fill(page, page.locator('textarea[name="message"]'), "DEMO follow-up message: I uploaded the missing document for review.");
    await page.getByRole("button", { name: /send message/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    await addOverlay(page, "Message sent");
    await wait(1_200);
    await goto(page, `${seed.portalUrl}#confirmations`, "Client acknowledgement", "05-confirmations");
    await page.locator('input[name="acknowledgement"]').check();
    await wait(500);
    await page.getByRole("button", { name: /record acknowledgement/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    await addOverlay(page, "Acknowledgement recorded");
    await wait(1_200);
    await goto(page, seed.portalUrl.replace("/client/portal/", "/client/book/"), "Appointment request fallback", "06-appointment");
    const date = page.locator('input[name="preferredDate"]');
    if (await date.count()) await date.fill(nextDateInput(8));
    const notes = page.locator('textarea[name="notes"]');
    if (await notes.count()) await fill(page, notes, "DEMO request: please confirm a time for document review.");
    await page.locator('input[name="consent"]').check();
    await wait(500);
    await page.getByRole("button", { name: /request appointment/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    await addOverlay(page, "Appointment request recorded");
    await wait(1_200);
    await page.setViewportSize({ width: 390, height: 844 });
    await goto(page, seed.portalUrl, "Mobile portal", "07-mobile");
    await page.mouse.wheel(0, 600);
    await wait(1_000);
  } finally {
    await context.close();
    await browser.close();
    if (server) server.kill();
  }
  const output = await convertVideo();
  const duration = await videoDuration();
  const sizeBytes = (await stat(output)).size;
  await rm(VIDEO_TEMP_DIR, { recursive: true, force: true }).catch(() => null);
  await writeFile(SCRIPT_PATH, `# Fixed Client Portal Demo Script

Video: \`docs/demo/aria-client-portal-demo-fixed.mp4\`

This short segment shows the polished client portal using dummy Noah Rivera data only.

Flow:
1. Open portal home and review the next-action dashboard.
2. Open requested documents and upload a dummy PDF.
3. Send a secure portal message.
4. Record a client acknowledgement / confirmation.
5. Request an appointment through the no-live-availability fallback.
6. Show the mobile portal layout.

Safety:
Aria assists preparation. A registered migration agent must review before use. Aria does not lodge applications or guarantee visa outcomes. No real client data, secrets, raw portal tokens, token hashes, or raw document URLs are shown.

Duration: ${duration}
Size: ${Math.round(sizeBytes / 1024 / 1024 * 10) / 10} MB
`);
  console.log(JSON.stringify({ videoPath: output, duration, screenshots: (await readdir(SCREENSHOT_DIR)).filter((file) => file.endsWith(".png")).length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
