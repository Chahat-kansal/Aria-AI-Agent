import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  MATTER_HEALTH_BLOCKED_EMAIL,
  MATTER_HEALTH_BLOCKED_PASSWORD,
  MATTER_HEALTH_OWNER_EMAIL,
  MATTER_HEALTH_OWNER_PASSWORD,
  chromiumExecutable,
  login,
  seedMatterHealthWorkspace,
  startServer,
  stopServer
} from "@/scripts/helpers/matter-health-proof";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "matter-health-proof");
const BASE_URL = "http://localhost:3031";

async function saveScreenshot(page: any, fileName: string) {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: true });
}

async function main() {
  const seeded = await seedMatterHealthWorkspace();
  const server = await startServer(3031);
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
    await login(page, BASE_URL, MATTER_HEALTH_OWNER_EMAIL, MATTER_HEALTH_OWNER_PASSWORD, "public");
    await page.goto(`${BASE_URL}/app/matter-health`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(page, "01-matter-health-dashboard.png");

    await page.goto(`${BASE_URL}/app/matters/${seeded.red.matter.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("text=Operational health score").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "02-matter-level-health-panel.png");

    await page.goto(`${BASE_URL}/app/matter-health`, { waitUntil: "domcontentloaded" });
    await page.locator("text=Green Health Matter").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "03-green-health-matter.png");

    await page.getByRole("button", { name: /needs attention/i }).click();
    await page.locator("text=Amber Health Matter").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "04-amber-health-matter.png");

    await page.getByRole("button", { name: /at risk/i }).click();
    await page.locator("text=Red Health Matter").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "05-red-health-matter.png");

    await page.locator("text=Blockers list").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "06-blockers-list.png");

    await page.locator("text=Missing required evidence").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "07-missing-evidence-signals.png");

    await page.locator("text=Overdue deadlines").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "08-overdue-deadline-signals.png");

    await page.locator("text=Recommended next actions").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "09-recommended-next-actions.png");

    await page.locator("text=Agent review required").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "10-agent-review-required-warning.png");

    const blockedPage = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
    await login(blockedPage, BASE_URL, MATTER_HEALTH_BLOCKED_EMAIL, MATTER_HEALTH_BLOCKED_PASSWORD, "workspace");
    await blockedPage.goto(`${BASE_URL}/app/matter-health`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(blockedPage, "11-permission-blocked-state.png");
    await blockedPage.close();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/matter-health`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(page, "12-mobile-health-view.png");
  } finally {
    await browser.close().catch(() => null);
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
