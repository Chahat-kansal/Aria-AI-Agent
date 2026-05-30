import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { InvoicePaymentStatus, MatterStage, MatterStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "stripe-billing-proof");
const BASE_URL = "http://localhost:3018";
const WORKSPACE_SLUG = "stripe-billing-demo";
const OWNER_EMAIL = "owner.stripe.demo@example.com";
const OWNER_PASSWORD = "Stripe-Demo-2026!";

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

async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "run", "dev", "--", "-p", String(port)], {
    cwd: ROOT,
    detached: false,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      NEXTAUTH_URL: `http://localhost:${port}`,
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      STRIPE_PRICE_ID_STARTER: "",
      STRIPE_PRICE_ID_PRO: "",
      STRIPE_PRICE_ID_TEAM: "",
      STRIPE_SUCCESS_URL: "",
      STRIPE_CANCEL_URL: "",
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
  return chromium.launch({
    executablePath: chromiumExecutable(),
    headless: true
  });
}

async function createContext(browser: Browser) {
  return browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
}

async function saveScreenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, name), fullPage });
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /Sign in to workspace/i }).click();
  await page.waitForURL(/\/app\/overview/, { timeout: 30_000 });
}

async function seedDemo() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Stripe Billing Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      billingPlan: "PRO",
      subscriptionStatus: "ACTIVE",
      billingProvider: "stripe",
      billingEmail: OWNER_EMAIL,
      stripeCustomerId: "cus_demo_billing",
      stripeSubscriptionId: "sub_demo_billing",
      currentPeriodEnd: new Date("2026-06-30T00:00:00.000Z")
    },
    update: {
      name: "BrightPath Stripe Billing Demo",
      plan: WorkspacePlan.PRO,
      contactEmail: OWNER_EMAIL,
      billingPlan: "PRO",
      subscriptionStatus: "ACTIVE",
      billingProvider: "stripe",
      billingEmail: OWNER_EMAIL,
      stripeCustomerId: "cus_demo_billing",
      stripeSubscriptionId: "sub_demo_billing",
      currentPeriodEnd: new Date("2026-06-30T00:00:00.000Z")
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      workspaceId: workspace.id,
      name: "Stripe Demo Owner",
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
      name: "Stripe Demo Owner",
      hashedPassword: await hash(OWNER_PASSWORD, 12),
      role: UserRole.COMPANY_OWNER,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.FIRM_WIDE,
      permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
      inviteAcceptedAt: new Date()
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "STRIPE-DEMO-CLIENT-001" },
    create: {
      workspaceId: workspace.id,
      clientReference: "STRIPE-DEMO-CLIENT-001",
      firstName: "Nina",
      lastName: "Patel",
      email: "nina.stripe.demo@example.com",
      phone: "+61 400 000 661",
      dob: new Date("1992-02-04T00:00:00.000Z"),
      nationality: "Demo nationality",
      assignedToUserId: owner.id
    },
    update: {
      workspaceId: workspace.id,
      firstName: "Nina",
      lastName: "Patel",
      email: "nina.stripe.demo@example.com",
      phone: "+61 400 000 661",
      assignedToUserId: owner.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "STRIPE-DEMO-MATTER-001" },
    create: {
      workspaceId: workspace.id,
      matterReference: "STRIPE-DEMO-MATTER-001",
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Nina Patel - Invoice Payment Demo",
      visaSubclass: "500",
      visaStream: "Higher Education",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 52
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: owner.id,
      title: "Nina Patel - Invoice Payment Demo",
      readinessScore: 52
    }
  });

  const invoice = await prisma.invoice.upsert({
    where: { workspaceId_invoiceNumber: { workspaceId: workspace.id, invoiceNumber: "INV-STRIPE-0001" } },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: owner.id,
      clientName: "Nina Patel",
      clientEmail: client.email,
      invoiceNumber: "INV-STRIPE-0001",
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 280000,
      gstCents: 28000,
      discountCents: 0,
      totalCents: 308000,
      lineItemsJson: [
        {
          description: "Migration services",
          quantity: 1,
          unitPriceCents: 280000,
          gstRateBps: 1000,
          isTaxInclusive: false
        }
      ],
      notes: "Demo invoice only.",
      reviewRequired: true
    },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      matterId: matter.id,
      createdByUserId: owner.id,
      clientName: "Nina Patel",
      clientEmail: client.email,
      issueDate: new Date("2026-05-31T00:00:00.000Z"),
      dueDate: new Date("2026-06-14T00:00:00.000Z"),
      currency: "AUD",
      subtotalCents: 280000,
      gstCents: 28000,
      discountCents: 0,
      totalCents: 308000,
      lineItemsJson: [
        {
          description: "Migration services",
          quantity: 1,
          unitPriceCents: 280000,
          gstRateBps: 1000,
          isTaxInclusive: false
        }
      ],
      notes: "Demo invoice only.",
      reviewRequired: true
    }
  });

  await prisma.invoicePaymentLink.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.billingEvent.deleteMany({ where: { workspaceId: workspace.id } });

  await prisma.invoicePaymentLink.create({
    data: {
      workspaceId: workspace.id,
      invoiceId: invoice.id,
      provider: "stripe",
      paymentStatus: InvoicePaymentStatus.NOT_CONFIGURED,
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      providerMetadataJson: {
        invoiceNumber: invoice.invoiceNumber,
        mode: "disabled"
      }
    }
  });

  await prisma.billingEvent.create({
    data: {
      workspaceId: workspace.id,
      provider: "stripe",
      eventType: "billing.webhook_rejected",
      status: "rejected",
      summary: "Webhook secret missing in demo configuration.",
      payloadPreviewJson: {
        eventType: "billing.webhook_rejected"
      }
    }
  });

  return { workspace, owner, invoice };
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

    await ownerPage.goto(`${BASE_URL}/app/settings/billing`, { waitUntil: "networkidle" });
    await saveScreenshot(ownerPage, "01-billing-page-provider-not-configured-state.png");
    await ownerPage.locator("text=Starter").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "02-plan-cards.png");
    await ownerPage.locator("text=Current subscription").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "03-current-plan-status.png");
    await ownerPage.locator("text=Manage billing").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "07-customer-portal-button-state.png");

    await ownerPage.goto(`${BASE_URL}/app/settings/integrations/payments`, { waitUntil: "networkidle" });
    await saveScreenshot(ownerPage, "04-stripe-integration-settings.png");
    await ownerPage.locator("text=Webhook secret").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "05-webhook-missing-status.png");
    await ownerPage.locator("text=Dry-run checkout payload preview").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "06-dry-run-checkout-payload-preview.png");

    await ownerPage.goto(`${BASE_URL}/app/invoices/${seeded.invoice.id}`, { waitUntil: "networkidle" });
    await ownerPage.locator("text=Invoice payment link").first().scrollIntoViewIfNeeded();
    await saveScreenshot(ownerPage, "08-invoice-payment-disabled-state.png");
    await saveScreenshot(ownerPage, "09-invoice-payment-link-created-state.png");

    await ownerPage.goto(`${BASE_URL}/admin/billing`, { waitUntil: "networkidle" });
    await saveScreenshot(ownerPage, "10-platform-admin-billing-metadata-view.png");
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
