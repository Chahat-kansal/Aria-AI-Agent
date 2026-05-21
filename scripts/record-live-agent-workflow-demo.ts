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
  ExtractionStatus,
  FieldStatus,
  MatterStage,
  MatterStatus,
  ReviewStatus,
  UserRole,
  UserStatus,
  UserVisibilityScope,
  WorkspacePlan
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ensureClientPortalToken } from "../lib/services/client-workflows";

const execFile = promisify(execFileCb);
const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3007";
const DEMO_DIR = path.join(ROOT, "docs", "demo");
const VIDEO_TEMP_DIR = path.join(DEMO_DIR, ".live-video-temp");
const VIDEO_PATH = path.join(DEMO_DIR, "aria-live-agent-workflow-demo.mp4");
const WEBM_PATH = path.join(DEMO_DIR, "aria-live-agent-workflow-demo.webm");
const DUMMY_UPLOAD_DIR = path.join(DEMO_DIR, "dummy-documents");
const DUMMY_UPLOAD_PATH = path.join(DUMMY_UPLOAD_DIR, "DEMO-DOCUMENT-NOT-REAL-CLIENT-DATA-bank-statement.pdf");
const WORKSPACE_SLUG = "brightpath-migration-demo";
const PASSWORD = "BrightPath-Demo-Only-2026!";

type Seed = {
  ownerEmail: string;
  sarahEmail: string;
  portalUrl: string;
  studentMatterId: string;
  pathwayId: string | null;
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function dateInput(days: number) {
  return addDays(days).toISOString().slice(0, 10);
}

function dateTimeInput(days: number, hour = 10, minute = 30) {
  const date = addDays(days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString().slice(0, 16);
}

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

function ffmpegExecutable() {
  try {
    const installed = require("@ffmpeg-installer/ffmpeg") as { path?: string };
    if (installed.path && existsSync(installed.path)) return installed.path;
  } catch {
    // Fallback below.
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
      // Keep polling while the local app starts.
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

async function upsertUser(input: {
  workspaceId: string;
  name: string;
  email: string;
  role: UserRole;
  visibilityScope: UserVisibilityScope;
  supervisorId?: string | null;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      workspaceId: input.workspaceId,
      name: input.name,
      email: input.email,
      role: input.role,
      status: UserStatus.ACTIVE,
      hashedPassword: await hash(PASSWORD, 12),
      visibilityScope: input.visibilityScope,
      supervisorId: input.supervisorId ?? undefined,
      jobTitle: input.role === UserRole.COMPANY_OWNER ? "Principal Migration Agent" : "Registered Migration Agent"
    },
    update: {
      workspaceId: input.workspaceId,
      name: input.name,
      role: input.role,
      status: UserStatus.ACTIVE,
      hashedPassword: await hash(PASSWORD, 12),
      visibilityScope: input.visibilityScope,
      supervisorId: input.supervisorId ?? undefined
    }
  });
}

async function seedDemo(): Promise<Seed> {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Migration Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      legalName: "BrightPath Migration Demo Pty Ltd",
      contactEmail: "owner@brightpath-demo.com",
      contactPhone: "+61 2 5550 0100",
      addressLine1: "100 Demo Street",
      city: "Sydney",
      state: "NSW",
      postalCode: "2000",
      country: "Australia",
      timezone: "Australia/Sydney"
    },
    update: {
      name: "BrightPath Migration Demo",
      plan: WorkspacePlan.PRO,
      legalName: "BrightPath Migration Demo Pty Ltd",
      contactEmail: "owner@brightpath-demo.com"
    }
  });

  const owner = await upsertUser({
    workspaceId: workspace.id,
    name: "Olivia Bright",
    email: "owner@brightpath-demo.com",
    role: UserRole.COMPANY_OWNER,
    visibilityScope: UserVisibilityScope.FIRM_WIDE
  });
  const sarah = await upsertUser({
    workspaceId: workspace.id,
    name: "Sarah Nguyen",
    email: "agent.sarah@brightpath-demo.com",
    role: UserRole.SENIOR_MIGRATION_AGENT,
    visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT,
    supervisorId: owner.id
  });
  await upsertUser({
    workspaceId: workspace.id,
    name: "James Patel",
    email: "agent.james@brightpath-demo.com",
    role: UserRole.MIGRATION_AGENT,
    visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
    supervisorId: sarah.id
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "DEMO-AARAV" },
    create: {
      workspaceId: workspace.id,
      clientReference: "DEMO-AARAV",
      firstName: "Aarav",
      lastName: "Sharma",
      email: "client.aarav@brightpath-demo.com",
      phone: "+61 400 000 101",
      nationality: "Demo nationality",
      dob: new Date("1998-03-12T00:00:00.000Z"),
      currentVisaStatus: "Demo visa status - not real client data",
      currentVisaExpiry: addDays(90),
      assignedToUserId: sarah.id,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Aarav",
      lastName: "Sharma",
      email: "client.aarav@brightpath-demo.com",
      assignedToUserId: sarah.id,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "DEMO-MATTER-500-AARAV" },
    create: {
      workspaceId: workspace.id,
      matterReference: "DEMO-MATTER-500-AARAV",
      clientId: client.id,
      title: "Aarav Sharma - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.AWAITING_DOCS,
      stage: MatterStage.EVIDENCE,
      assignedToUserId: sarah.id,
      readinessScore: 68,
      currentVisaStatus: "Demo current visa - not real client data",
      currentVisaExpiry: addDays(80),
      criticalDeadline: addDays(28),
      lodgementTargetDate: addDays(45),
      expectedNextMilestone: "Agent final review after evidence confirmation"
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      title: "Aarav Sharma - Subclass 500 Student",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.AWAITING_DOCS,
      stage: MatterStage.EVIDENCE,
      assignedToUserId: sarah.id,
      readinessScore: 68,
      currentVisaExpiry: addDays(80),
      criticalDeadline: addDays(28),
      lodgementTargetDate: addDays(45)
    }
  });

  const storageKey = `demo/brightpath/${matter.id}/DEMO DOCUMENT - Aarav passport.pdf`;
  const existingDocument = await prisma.document.findFirst({ where: { workspaceId: workspace.id, storageKey } });
  const documentData = {
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    uploadedByUserId: sarah.id,
    fileName: "DEMO DOCUMENT - Aarav passport.pdf",
    storageKey,
    mimeType: "application/pdf",
    fileSize: 2048,
    category: "Identity",
    extractionStatus: ExtractionStatus.EXTRACTED,
    reviewStatus: ReviewStatus.VERIFIED
  };
  const document = existingDocument
    ? await prisma.document.update({ where: { id: existingDocument.id }, data: documentData })
    : await prisma.document.create({
      data: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      uploadedByUserId: sarah.id,
      fileName: "DEMO DOCUMENT - Aarav passport.pdf",
      storageKey,
      mimeType: "application/pdf",
      fileSize: 2048,
      category: "Identity",
      extractionStatus: ExtractionStatus.EXTRACTED,
      reviewStatus: ReviewStatus.VERIFIED
      }
    });

  await prisma.documentStorageObject.upsert({
    where: { documentId: document.id },
    create: {
      documentId: document.id,
      provider: "DEMO_SECURE_VAULT",
      storageKey,
      data: Buffer.from("DEMO DOCUMENT - NOT REAL CLIENT DATA\nPassport number: DEMO-P5001234")
    },
    update: {
      provider: "DEMO_SECURE_VAULT",
      storageKey,
      data: Buffer.from("DEMO DOCUMENT - NOT REAL CLIENT DATA\nPassport number: DEMO-P5001234")
    }
  });

  const existingField = await prisma.extractedField.findFirst({
    where: { documentId: document.id, fieldKey: "identity.passport_number" }
  });
  const fieldData = {
    matterId: matter.id,
    documentId: document.id,
    fieldKey: "identity.passport_number",
    fieldLabel: "Passport number",
    fieldValue: "DEMO-P5001234",
    confidence: 0.92,
    sourceSnippet: "DEMO DOCUMENT - NOT REAL CLIENT DATA",
    sourcePageRef: "Demo page 1",
    status: FieldStatus.VERIFIED,
    needsReview: false
  };
  if (existingField) await prisma.extractedField.update({ where: { id: existingField.id }, data: fieldData });
  else await prisma.extractedField.create({ data: fieldData });

  const existingChecklist = await prisma.checklistItem.findFirst({ where: { matterId: matter.id, itemKey: "passport" } });
  const checklistData = {
    matterId: matter.id,
    documentId: document.id,
    itemKey: "passport",
    category: "Identity",
    label: "Passport",
    description: "DEMO checklist item - not official legal advice.",
    status: "Approved for AI Working Copy",
    required: true,
    dueDate: addDays(2),
    requestedAt: new Date(),
    reviewedAt: new Date()
  };
  if (existingChecklist) await prisma.checklistItem.update({ where: { id: existingChecklist.id }, data: checklistData });
  else await prisma.checklistItem.create({ data: checklistData });

  for (const item of [
    ["coe", "Education", "COE", 3],
    ["oshc", "Health / Insurance", "OSHC certificate", 7],
    ["bank_statement", "Financial capacity", "Bank statements", 5]
  ] as const) {
    const found = await prisma.checklistItem.findFirst({ where: { matterId: matter.id, itemKey: item[0] } });
    const data = {
      matterId: matter.id,
      itemKey: item[0],
      category: item[1],
      label: item[2],
      description: "DEMO checklist item - not official legal advice.",
      status: "Missing",
      required: true,
      dueDate: addDays(item[3]),
      requestedAt: new Date()
    };
    if (found) await prisma.checklistItem.update({ where: { id: found.id }, data });
    else await prisma.checklistItem.create({ data });
  }

  const pathway = await prisma.pathwayAnalysis.findFirst({
    where: { workspaceId: workspace.id, matterId: matter.id, title: "Aarav demo pathway analysis" },
    select: { id: true }
  });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Aarav live workflow demo portal",
    createdByUserId: sarah.id,
    requestOrigin: BASE_URL
  });

  return {
    ownerEmail: owner.email,
    sarahEmail: sarah.email,
    portalUrl: portal.url,
    studentMatterId: matter.id,
    pathwayId: pathway?.id ?? null
  };
}

async function ensureDummyUploadFile() {
  await mkdir(DUMMY_UPLOAD_DIR, { recursive: true });
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 126 >>
stream
BT /F1 18 Tf 72 720 Td (DEMO DOCUMENT - NOT REAL CLIENT DATA) Tj 0 -32 Td (BrightPath demo bank statement upload) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000417 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
487
%%EOF`;
  await writeFile(DUMMY_UPLOAD_PATH, content, "utf8");
}

async function addDemoOverlay(page: Page, title: string) {
  await page.evaluate((label) => {
    document.querySelector("[data-live-demo-banner]")?.remove();
    document.querySelector("[data-live-demo-cursor]")?.remove();
    const banner = document.createElement("div");
    banner.setAttribute("data-live-demo-banner", "true");
    banner.textContent = `LIVE TRAINING DEMO - DUMMY DATA ONLY - ${label}`;
    Object.assign(banner.style, {
      position: "fixed",
      zIndex: "2147483647",
      top: "14px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      borderRadius: "999px",
      background: "rgba(15, 23, 42, 0.94)",
      color: "white",
      font: "700 14px system-ui",
      boxShadow: "0 18px 48px rgba(0,0,0,0.30)",
      pointerEvents: "none"
    });
    const cursor = document.createElement("div");
    cursor.setAttribute("data-live-demo-cursor", "true");
    Object.assign(cursor.style, {
      position: "fixed",
      zIndex: "2147483646",
      left: "60px",
      top: "60px",
      width: "22px",
      height: "22px",
      borderRadius: "999px",
      background: "rgba(34, 211, 238, 0.90)",
      border: "3px solid white",
      boxShadow: "0 10px 30px rgba(8, 145, 178, 0.55)",
      pointerEvents: "none",
      transition: "left 240ms ease, top 240ms ease"
    });
    document.body.appendChild(banner);
    document.body.appendChild(cursor);
  }, title).catch(() => null);
}

async function moveCursor(page: Page, locator: Locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  const x = Math.round(box.x + Math.min(box.width / 2, 260));
  const y = Math.round(box.y + Math.min(box.height / 2, 32));
  await page.evaluate(([left, top]) => {
    const cursor = document.querySelector("[data-live-demo-cursor]") as HTMLElement | null;
    if (cursor) {
      cursor.style.left = `${left}px`;
      cursor.style.top = `${top}px`;
    }
  }, [x, y]);
  await wait(260);
}

async function liveClick(page: Page, locator: Locator) {
  await moveCursor(page, locator);
  await locator.click({ timeout: 15_000 });
  await wait(650);
}

async function liveFill(page: Page, locator: Locator, value: string) {
  await moveCursor(page, locator);
  await locator.click({ timeout: 15_000 });
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 35 });
  await wait(250);
}

async function goto(page: Page, url: string, title: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
  await addDemoOverlay(page, title);
  await wait(1_000);
}

async function signInOwnerLive(page: Page, seed: Seed) {
  await goto(page, `${BASE_URL}/auth/sign-in`, "Owner signs in");
  await liveFill(page, page.locator('input[name="email"]'), seed.ownerEmail);
  await liveFill(page, page.locator('input[name="password"]'), PASSWORD);
  await liveClick(page, page.getByRole("button", { name: /sign in/i }));
  await page.waitForURL(/\/app\/overview/, { timeout: 12_000 }).catch(async () => {
    const csrf = await (await page.request.get(`${BASE_URL}/api/auth/csrf`)).json() as { csrfToken: string };
    await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
      form: { csrfToken: csrf.csrfToken, email: seed.ownerEmail, password: PASSWORD, redirect: "false", json: "true" }
    });
    await page.goto(`${BASE_URL}/app/overview`, { waitUntil: "domcontentloaded" });
  });
  await addDemoOverlay(page, "Owner dashboard after real sign-in form");
  await wait(1_300);
}

async function scrollSection(page: Page, amount = 620) {
  await page.mouse.wheel(0, amount);
  await wait(900);
}

async function createMatterLive(page: Page) {
  await goto(page, `${BASE_URL}/app/matters`, "Owner creates a new matter");
  await liveFill(page, page.locator('input[name="clientFirstName"]'), "Noah");
  await liveFill(page, page.locator('input[name="clientLastName"]'), "Rivera");
  await liveFill(page, page.locator('input[name="clientEmail"]'), `client.noah.workflow+${Date.now()}@brightpath-demo.com`);
  await liveFill(page, page.locator('input[name="clientPhone"]'), "+61 400 000 220");
  await page.locator('input[name="clientDob"]').fill("1999-04-18");
  await wait(250);
  await liveFill(page, page.locator('input[name="nationality"]'), "Demo nationality");
  await liveFill(page, page.locator('input[name="title"]'), "Noah Rivera - Subclass 500 Student demo");
  await page.locator('select[name="visaSubclass"]').selectOption("500");
  await wait(300);
  await liveFill(page, page.locator('input[name="visaStream"]'), "Higher Education");
  await page.locator('input[name="lodgementTargetDate"]').fill(dateInput(42));
  await wait(350);
  await liveClick(page, page.getByRole("button", { name: /create matter/i }));
  await page.waitForURL(/\/app\/matters\/[^/]+$/, { timeout: 20_000 });
  await addDemoOverlay(page, "New matter opened");
  await wait(1_600);
  const url = page.url();
  return url.split("/app/matters/")[1]?.split(/[?#/]/)[0] || "";
}

async function demonstrateMatterWork(page: Page, matterId: string) {
  await goto(page, `${BASE_URL}/app/matters/${matterId}`, "Matter workflow hub");
  await scrollSection(page, 520);
  await goto(page, `${BASE_URL}/app/matters/${matterId}/checklist`, "Required documents checklist");
  await scrollSection(page, 520);
  await goto(page, `${BASE_URL}/app/matters/${matterId}/review`, "Evidence review and AI Working Copy");
  await scrollSection(page, 660);
  await goto(page, `${BASE_URL}/app/matters/${matterId}/full-draft`, "Full staff review application draft");
  await scrollSection(page, 700);
  await scrollSection(page, 700);
}

async function fillAppointmentLive(page: Page) {
  await goto(page, `${BASE_URL}/app/appointments`, "Agent records an appointment");
  const matterSelect = page.locator('select[name="matterId"]');
  await liveClick(page, matterSelect);
  const options = await matterSelect.locator("option").all();
  if (options.length > 1) await matterSelect.selectOption({ index: 1 });
  await wait(300);
  const assigneeSelect = page.locator('select[name="assignedToUserId"]');
  const assigneeOptions = await assigneeSelect.locator("option").all();
  if (assigneeOptions.length > 1) await assigneeSelect.selectOption({ index: 1 });
  await liveFill(page, page.locator('input[name="meetingType"]'), "Evidence review consultation");
  await page.locator('input[name="startsAt"]').fill(dateTimeInput(5, 11, 0));
  await liveFill(page, page.locator('input[name="requestedByName"]'), "Noah Rivera");
  await liveFill(page, page.locator('input[name="requestedByEmail"]'), "client.noah.workflow@brightpath-demo.com");
  await liveFill(page, page.locator('textarea[name="notes"]'), "DEMO appointment note - review missing OSHC and bank statement evidence.");
  await liveClick(page, page.getByRole("button", { name: /save appointment/i }));
  await wait(1_600);
}

async function fillInvoiceLive(page: Page) {
  await goto(page, `${BASE_URL}/app/invoices/new`, "Owner creates a stage-based invoice");
  await scrollSection(page, 380);
  const matterSelect = page.locator("select").first();
  const optionCount = await matterSelect.locator("option").count().catch(() => 0);
  if (optionCount > 1) await matterSelect.selectOption({ index: 1 });
  await wait(500);
  const address = page.locator("textarea").first();
  await liveFill(page, address, "DEMO postal address only\n100 Demo Street\nSydney NSW 2000");
  await scrollSection(page, 520);
  const descriptions = page.locator('input[placeholder="Migration service description"]');
  if (await descriptions.count()) {
    await liveFill(page, descriptions.first(), "Demo student visa preparation stage - agent review required");
  }
  await scrollSection(page, 580);
  const notes = page.locator('textarea[placeholder="Optional notes for the client"]');
  if (await notes.count()) {
    await liveFill(page, notes.first(), "DEMO invoice only. This is operational billing support, not trust accounting advice.");
  }
  await wait(1_000);
}

async function fillPathwayLive(page: Page, seed: Seed, matterId: string) {
  await goto(page, `${BASE_URL}/app/pathways`, "Pathway intelligence form");
  await liveFill(page, page.locator('input[name="title"]'), "Noah demo pathway analysis");
  const matterSelect = page.locator('select[name="matterId"]');
  const options = await matterSelect.locator("option").count().catch(() => 0);
  if (options > 1) await matterSelect.selectOption({ index: 1 });
  await liveFill(page, page.locator('input[name="currentVisaStatus"]'), "Demo student visa expiring in 90 days");
  await liveFill(page, page.locator('input[name="age"]'), "26");
  await liveFill(page, page.locator('input[name="occupation"]'), "Demo business analyst");
  await liveFill(page, page.locator('input[name="englishLevel"]'), "PTE overall 72 - demo");
  await liveFill(page, page.locator('textarea[name="freeText"]'), "DEMO client profile only. Show possible pathways for agent review without legal advice or guarantees.");
  await wait(1_200);
  if (seed.pathwayId) {
    await goto(page, `${BASE_URL}/app/pathways/${seed.pathwayId}`, "Existing pathway analysis result");
    await scrollSection(page, 620);
  }
}

async function portalLive(page: Page, seed: Seed) {
  await goto(page, seed.portalUrl, "Client portal home");
  await scrollSection(page, 650);
  const messageBox = page.locator('textarea[name="message"]');
  if (await messageBox.count()) {
    await liveFill(page, messageBox, "DEMO client message: I uploaded the bank statement and can confirm this is not real client data.");
    await liveClick(page, page.getByRole("button", { name: /send secure message/i }));
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
    await addDemoOverlay(page, "Client message recorded");
    await wait(1_000);
  }
  const ack = page.locator('input[name="acknowledgement"]');
  if (await ack.count()) {
    await liveClick(page, ack);
    await liveClick(page, page.getByRole("button", { name: /record acknowledgement/i }));
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
    await addDemoOverlay(page, "Client acknowledgement recorded");
    await wait(1_000);
  }
  await goto(page, seed.portalUrl.replace("/client/portal/", "/client/documents/"), "Client uploads a dummy document");
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count()) {
    await moveCursor(page, fileInput);
    await fileInput.setInputFiles(DUMMY_UPLOAD_PATH);
    await wait(700);
    const consent = page.locator('input[name="consent"]').first();
    await liveClick(page, consent);
    await liveClick(page, page.getByRole("button", { name: /upload document/i }).first());
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
    await addDemoOverlay(page, "Dummy document uploaded through portal");
    await wait(1_400);
  }
  await goto(page, seed.portalUrl.replace("/client/portal/", "/client/book/"), "Client requests an appointment");
  const start = page.locator('input[name="startsAt"]');
  if (await start.count()) {
    await start.fill(dateTimeInput(8, 14, 30));
  }
  const notes = page.locator('textarea[name="notes"]');
  if (await notes.count()) {
    await liveFill(page, notes, "DEMO booking request: please discuss missing documents and next steps.");
  }
  const consent = page.locator('input[name="consent"]');
  if (await consent.count()) await liveClick(page, consent);
  await liveClick(page, page.getByRole("button", { name: /request appointment/i }));
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => null);
  await addDemoOverlay(page, "Client appointment request recorded");
  await wait(1_400);
}

async function askAriaLive(page: Page) {
  await goto(page, `${BASE_URL}/app/assistant`, "Ask Aria assistant");
  const textBox = page.locator("textarea").first();
  if (await textBox.count()) {
    await liveFill(page, textBox, "For this demo matter, summarise what evidence is missing and remind me that agent review is required.");
    await wait(1_200);
  }
}

async function convertVideo() {
  const files = await readdir(VIDEO_TEMP_DIR);
  const webm = files.find((file) => file.endsWith(".webm"));
  if (!webm) throw new Error("No Playwright webm recording was produced.");
  const source = path.join(VIDEO_TEMP_DIR, webm);
  const ffmpeg = ffmpegExecutable();
  if (!ffmpeg) {
    await rename(source, WEBM_PATH);
    return { output: WEBM_PATH, converted: false };
  }
  await rm(VIDEO_PATH, { force: true }).catch(() => null);
  await execFile(ffmpeg, ["-y", "-i", source, "-movflags", "+faststart", "-pix_fmt", "yuv420p", VIDEO_PATH], { cwd: ROOT });
  return { output: VIDEO_PATH, converted: true };
}

async function videoDuration() {
  const ffmpeg = ffmpegExecutable();
  if (!ffmpeg || !existsSync(VIDEO_PATH)) return "unknown";
  const result = await execFile(ffmpeg, ["-i", VIDEO_PATH], { cwd: ROOT }).catch((error: any) => error);
  const text = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  const match = text.match(/Duration:\s*([0-9:.]+)/);
  return match?.[1] ?? "unknown";
}

async function writeLiveDocs(duration: string, sizeBytes: number) {
  const script = `# Aria Live Agent Workflow Demo Script

Video: \`docs/demo/aria-live-agent-workflow-demo.mp4\`

This is a real browser workflow recording, not a screenshot slideshow. It shows an owner/agent using Aria with dummy BrightPath data only.

## Flow shown

1. Owner signs in through the real sign-in form.
2. Owner creates a new dummy Subclass 500 matter by filling the matter form.
3. Agent opens the matter workflow hub, checklist, evidence review, and full staff review draft.
4. Agent records a consultation appointment.
5. Owner fills a stage-based invoice draft.
6. Owner fills a pathway intelligence form and opens an existing result.
7. Client opens the secure portal, sends a message, records acknowledgement, uploads a dummy PDF, and requests an appointment.
8. Agent opens Ask Aria and types a safe review-required prompt.

## Safety narration

Aria assists preparation. A registered migration agent must review before use. Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications. All names, documents, messages, invoices, and profile facts shown here are dummy demo data.

## Recording details

- Duration: ${duration}
- Size: ${Math.round(sizeBytes / 1024 / 1024 * 10) / 10} MB
- No real client data used.
- No terminal, environment variables, database URLs, API keys, raw portal tokens, token hashes, or raw document URLs are shown.
`;

  const readme = `# Aria Live Agent Workflow Demo

Primary live demo video: \`docs/demo/aria-live-agent-workflow-demo.mp4\`

This recording is a real browser interaction walkthrough. It is intentionally separate from the older screenshot-based guide video.

## Regenerate

\`\`\`powershell
npx tsx scripts/record-live-agent-workflow-demo.ts
\`\`\`

The script seeds dummy BrightPath data, starts the local app if needed, records a 1920x1080 browser workflow, and saves an MP4.
`;

  await writeFile(path.join(DEMO_DIR, "aria-live-agent-workflow-script.md"), script);
  await writeFile(path.join(DEMO_DIR, "LIVE_DEMO_README.md"), readme);
}

async function main() {
  await mkdir(DEMO_DIR, { recursive: true });
  await rm(VIDEO_TEMP_DIR, { recursive: true, force: true }).catch(() => null);
  await mkdir(VIDEO_TEMP_DIR, { recursive: true });
  await ensureDummyUploadFile();
  const seed = await seedDemo();
  const server: ChildProcess | null = await ensureLocalServer();

  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: VIDEO_TEMP_DIR, size: { width: 1920, height: 1080 } }
  });
  const page = await context.newPage();

  try {
    await signInOwnerLive(page, seed);
    const newMatterId = await createMatterLive(page);
    await demonstrateMatterWork(page, newMatterId || seed.studentMatterId);
    await fillAppointmentLive(page);
    await fillInvoiceLive(page);
    await fillPathwayLive(page, seed, newMatterId || seed.studentMatterId);
    await portalLive(page, seed);
    await signInOwnerLive(page, seed);
    await askAriaLive(page);
    await goto(page, `${BASE_URL}/app/matters/${newMatterId || seed.studentMatterId}/full-draft`, "Final staff review draft result");
    await scrollSection(page, 760);
    await wait(1_500);
  } finally {
    await context.close();
    await browser.close();
    if (server) server.kill();
  }

  const video = await convertVideo();
  const duration = await videoDuration();
  const sizeBytes = (await stat(video.output)).size;
  await writeLiveDocs(duration, sizeBytes);

  console.log(JSON.stringify({
    liveVideoCreated: existsSync(video.output),
    videoPath: video.output,
    convertedToMp4: video.converted,
    duration,
    sizeBytes,
    scriptPath: path.join(DEMO_DIR, "aria-live-agent-workflow-script.md")
  }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
