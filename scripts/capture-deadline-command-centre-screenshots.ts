import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  chromiumExecutable,
  DEADLINE_OWNER_EMAIL,
  DEADLINE_OWNER_PASSWORD,
  login,
  restoreDefaultDeadlineOwnerPermissions,
  setDeadlineOwnerPermissionsBlocked,
  seedDeadlineWorkspace,
  startServer,
  stopServer
} from "@/scripts/helpers/deadline-command-centre-proof";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "docs", "demo", "deadline-command-centre-proof");
const BASE_URL = "http://localhost:3029";

async function saveScreenshot(page: any, fileName: string) {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT_DIR, fileName), fullPage: true });
}

async function main() {
  const seeded = await seedDeadlineWorkspace();
  const server = await startServer(3029);
  const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1280 } });
    await login(page, BASE_URL, DEADLINE_OWNER_EMAIL, DEADLINE_OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/app/deadlines`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(page, "01-deadline-dashboard.png");

    await page.getByRole("button", { name: /overdue/i }).click();
    await saveScreenshot(page, "02-overdue-deadlines.png");

    await page.getByRole("button", { name: /urgent/i }).click();
    await saveScreenshot(page, "03-urgent-deadlines.png");

    await page.getByRole("button", { name: /upcoming/i }).click();
    await saveScreenshot(page, "04-upcoming-deadlines.png");

    await page.getByLabel("Title").fill("Deadline proof creation item");
    await page.getByLabel("Safe summary").fill("Proof-only manual deadline for command centre screenshots.");
    await page.getByLabel("Due").fill(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    await saveScreenshot(page, "05-create-deadline.png");

    await page.getByRole("button", { name: /review required/i }).first().click();
    await saveScreenshot(page, "06-review-required-calculated-suggested-deadline.png");

    await page.goto(`${BASE_URL}/app/matters/${seeded.matterPrimary.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("text=Matter deadline panel").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "07-matter-level-deadline-panel.png");

    await page.goto(`${BASE_URL}/app/deadlines`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /all open/i }).click();
    await page.getByRole("button", { name: /preview reminder/i }).first().click();
    await page.locator("text=Reminder preview").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "08-reminder-preview.png");

    await setDeadlineOwnerPermissionsBlocked(seeded.owner.id);
    try {
      const blockedPage = await browser.newPage({ viewport: { width: 1280, height: 960 } });
      await login(blockedPage, BASE_URL, DEADLINE_OWNER_EMAIL, DEADLINE_OWNER_PASSWORD);
      await blockedPage.goto(`${BASE_URL}/app/deadlines`, { waitUntil: "domcontentloaded" });
      await saveScreenshot(blockedPage, "09-permission-blocked-state.png");
      await blockedPage.close();
    } finally {
      await restoreDefaultDeadlineOwnerPermissions(seeded.owner.id);
    }

    await page.goto(`${BASE_URL}/app/deadlines`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^completed$/i }).click();
    await saveScreenshot(page, "10-completed-deadline.png");

    await page.locator("text=History and audit").first().scrollIntoViewIfNeeded();
    await saveScreenshot(page, "11-audit-history-view.png");

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await login(mobilePage, BASE_URL, DEADLINE_OWNER_EMAIL, DEADLINE_OWNER_PASSWORD);
    await mobilePage.goto(`${BASE_URL}/app/deadlines`, { waitUntil: "domcontentloaded" });
    await saveScreenshot(mobilePage, "12-mobile-deadline-view.png");
    await mobilePage.close();
  } finally {
    await browser.close().catch(() => null);
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
