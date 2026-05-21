import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Page } from "playwright-core";
import { MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";

const ROOT = process.cwd();
const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3007";
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "fixed-ui-screenshots");
const WORKSPACE_SLUG = "aria-fixed-ui-qa";
const EMAIL = "owner-fixed-ui-qa@example.com";
const PASSWORD = "Aria-Fixed-Ui-QA-Only-2026!";

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

async function waitForApp(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE_URL, { cache: "no-store" });
      if (res.status < 500) return true;
    } catch {
      // Keep polling while the local app starts.
    }
    await wait(1_000);
  }
  return false;
}

async function ensureLocalServer(): Promise<ChildProcess | null> {
  if (await waitForApp(3_000)) return null;
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", "3007"], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true
  });
  if (!(await waitForApp())) {
    child.kill();
    throw new Error(`Local app did not become available at ${BASE_URL}`);
  }
  return child;
}

async function seedQaData() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "Aria Fixed UI QA",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      legalName: "Aria Fixed UI QA Pty Ltd",
      contactEmail: "billing@fixed-ui-qa.example",
      contactPhone: "+61 2 5550 0100",
      addressLine1: "100 Demo Street",
      city: "Sydney",
      state: "NSW",
      postalCode: "2000",
      country: "Australia"
    },
    update: {
      name: "Aria Fixed UI QA",
      plan: WorkspacePlan.PRO,
      contactEmail: "billing@fixed-ui-qa.example"
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Fixed UI QA Owner",
      email: EMAIL,
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      name: "Fixed UI QA Owner",
      hashedPassword: await hash(PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  await prisma.invoiceBranding.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      businessName: "Aria Fixed UI QA",
      legalName: "Aria Fixed UI QA Pty Ltd",
      contactEmail: "billing@fixed-ui-qa.example",
      contactPhone: "+61 2 5550 0100",
      addressLine1: "100 Demo Street",
      city: "Sydney",
      state: "NSW",
      postalCode: "2000",
      country: "Australia",
      abnAcn: "12 345 678 901",
      paymentInstructions: "Demo payment instructions only. No real payment data.",
      defaultCurrency: "AUD",
      defaultGstRateBps: 1000,
      defaultDueDays: 14
    },
    update: {
      businessName: "Aria Fixed UI QA",
      legalName: "Aria Fixed UI QA Pty Ltd",
      contactEmail: "billing@fixed-ui-qa.example",
      paymentInstructions: "Demo payment instructions only. No real payment data.",
      defaultCurrency: "AUD",
      defaultGstRateBps: 1000,
      defaultDueDays: 14
    }
  });

  await prisma.invoiceService.upsert({
    where: { id: `fixed-ui-service-${workspace.id}` },
    create: {
      id: `fixed-ui-service-${workspace.id}`,
      workspaceId: workspace.id,
      serviceName: "Subclass 500 preparation review",
      description: "Staff preparation and agent review of a student visa matter.",
      defaultPriceCents: 220000,
      currency: "AUD",
      gstRateBps: 1000,
      isTaxInclusive: false,
      active: true
    },
    update: {
      serviceName: "Subclass 500 preparation review",
      description: "Staff preparation and agent review of a student visa matter.",
      defaultPriceCents: 220000,
      active: true
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "fixed-ui-qa-client" },
    create: {
      workspaceId: workspace.id,
      clientReference: "fixed-ui-qa-client",
      firstName: "Noah",
      lastName: "Rivera",
      dob: new Date("1998-02-14T00:00:00.000Z"),
      nationality: "Demo",
      email: "noah.rivera.fixed-ui@example.com",
      phone: "0400000000",
      assignedToUserId: owner.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Noah",
      lastName: "Rivera",
      email: "noah.rivera.fixed-ui@example.com",
      assignedToUserId: owner.id
    }
  });

  const existingMatter = await prisma.matter.findFirst({
    where: { workspaceId: workspace.id, title: "Noah Rivera - Subclass 500 Student" }
  });
  await (existingMatter
    ? prisma.matter.update({
        where: { id: existingMatter.id },
        data: {
          clientId: client.id,
          assignedToUserId: owner.id,
          visaSubclass: "500",
          visaStream: "Student",
          status: MatterStatus.IN_PROGRESS,
          stage: MatterStage.EVIDENCE,
          readinessScore: 46
        }
      })
    : prisma.matter.create({
        data: {
          workspaceId: workspace.id,
          clientId: client.id,
          assignedToUserId: owner.id,
          title: "Noah Rivera - Subclass 500 Student",
          visaSubclass: "500",
          visaStream: "Student",
          status: MatterStatus.IN_PROGRESS,
          stage: MatterStage.EVIDENCE,
          readinessScore: 46
        }
      }));

  await prisma.visaKnowledgeRecord.upsert({
    where: {
      sourceUrl_contentHash: {
        sourceUrl: "https://immi.homeaffairs.gov.au/demo-fixed-ui-qa/subclass-500",
        contentHash: "fixed-ui-qa-subclass-500"
      }
    },
    create: {
      workspaceId: workspace.id,
      subclassCode: "500",
      stream: "Student",
      title: "Subclass 500 student visa preparation evidence",
      summary: "Source-linked guidance for agent review covering student evidence, English evidence, financial capacity, OSHC, COE, and genuine student preparation points.",
      keyRequirementsJson: ["COE", "English evidence", "Financial capacity", "OSHC", "Genuine student material"],
      evidenceJson: ["Passport", "COE", "Bank statement", "OSHC certificate", "Academic transcript"],
      sourceUrl: "https://immi.homeaffairs.gov.au/demo-fixed-ui-qa/subclass-500",
      sourceType: "OFFICIAL",
      contentHash: "fixed-ui-qa-subclass-500",
      lastRefreshedAt: new Date()
    },
    update: {
      workspaceId: workspace.id,
      lastRefreshedAt: new Date(),
      summary: "Source-linked guidance for agent review covering student evidence, English evidence, financial capacity, OSHC, COE, and genuine student preparation points."
    }
  });
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("aria-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }, theme);
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function main() {
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await seedQaData();
  const server = await ensureLocalServer();

  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  try {
    await login(page);
    await setTheme(page, "light");

    await page.goto(`${BASE_URL}/app/knowledge`);
    await page.waitForLoadState("networkidle").catch(() => null);
    await saveScreenshot(page, "01-visa-knowledge-light.png");

    await page.goto(`${BASE_URL}/app/knowledge?q=${encodeURIComponent("zzzz-no-record-demo")}`);
    await page.waitForLoadState("networkidle").catch(() => null);
    await saveScreenshot(page, "02-visa-knowledge-empty-state.png");

    await page.goto(`${BASE_URL}/app/invoices/new`);
    await page.waitForLoadState("networkidle").catch(() => null);
    await saveScreenshot(page, "03-invoice-builder-empty-light.png");

    await page.getByPlaceholder("Select or enter client details").fill("Noah Rivera");
    await page.getByPlaceholder("client@example.com").fill("noah.rivera.fixed-ui@example.com");
    await page.getByPlaceholder("Client postal address").fill("100 Demo Client Street\nSydney NSW 2000");
    await page.getByPlaceholder("Add your first service line").fill("Subclass 500 student visa preparation and agent review");
    await page.locator("input").filter({ hasText: "" }).nth(8).fill("2200.00").catch(() => null);
    const unitPriceInput = page.locator("tbody input").nth(1);
    await unitPriceInput.fill("2200.00");
    await page.getByPlaceholder("Optional notes for the client").fill("Demo invoice only. Billing review required before issue.");
    await saveScreenshot(page, "04-invoice-builder-with-line-items-light.png");

    await setTheme(page, "dark");
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => null);
    await saveScreenshot(page, "05-invoice-builder-dark.png");

    await page.emulateMedia({ media: "print" });
    await saveScreenshot(page, "06-invoice-print-view.png");
    await page.emulateMedia({ media: "screen" });

    await setTheme(page, "light");
    await page.goto(`${BASE_URL}/app/invoices/new`);
    await page.waitForLoadState("networkidle").catch(() => null);
    await saveScreenshot(page, "07-runtime-route-fixed-invoice.png");
  } finally {
    await browser.close();
    await prisma.$disconnect();
    if (server) server.kill();
  }

  console.log(`Saved fixed UI screenshots to ${OUTPUT_DIR}`);
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
