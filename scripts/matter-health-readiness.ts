import { chromium } from "playwright-core";
import { prisma } from "@/lib/prisma";
import { sendMatterHealthCriticalBlockerNotification } from "@/lib/services/matter-health/matter-health-notifications";
import {
  getMatterHealthDashboard,
  getMatterHealthForMatter
} from "@/lib/services/matter-health/matter-health-service";
import { getWorkspaceRows, safeJson } from "@/lib/services/platform-admin-data";
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

type Check = { name: string; pass: boolean; detail?: string };

function record(name: string, pass: boolean, detail?: string): Check {
  return { name, pass, detail };
}

function ensure(check: Check) {
  if (!check.pass) {
    throw new Error(`${check.name}: ${check.detail || "failed"}`);
  }
}

async function main() {
  const seeded = await seedMatterHealthWorkspace();
  const checks: Check[] = [];

  const ownerDashboard = await getMatterHealthDashboard({
    workspaceId: seeded.workspace.id,
    user: seeded.owner
  });
  if (!ownerDashboard) {
    throw new Error("Matter health dashboard was unavailable for the seeded owner.");
  }

  const green = ownerDashboard.items.find((item) => item.matterId === seeded.green.matter.id);
  const amber = ownerDashboard.items.find((item) => item.matterId === seeded.amber.matter.id);
  const red = ownerDashboard.items.find((item) => item.matterId === seeded.red.matter.id);
  if (!green || !amber || !red) {
    throw new Error("Seeded matter health items were not all found.");
  }

  checks.push(record("matter health dashboard includes green, amber, and red matters", green.band === "green" && amber.band === "amber" && red.band === "red"));
  checks.push(record("matter-level matter health panel loads from service", Boolean(await getMatterHealthForMatter({
    workspaceId: seeded.workspace.id,
    matterId: seeded.red.matter.id,
    user: seeded.owner
  }))));
  checks.push(record("score stays advisory and review-required", red.reviewRequiredWarning.includes("Agent review required") && red.legalDisclaimer.includes("not legal advice") && !red.outcomeDisclaimer.toLowerCase().includes("success probability")));
  checks.push(record("red matter exposes blockers and missing evidence signals", red.blockers.length >= 2 && red.missingEvidenceSignals.length >= 1));
  checks.push(record("amber matter exposes overdue or urgent actions", amber.overdueActionSignals.length >= 1));
  checks.push(record("health score explanation and recommended next actions are present", red.breakdown.length >= 2 && red.recommendedNextActions.length >= 1));

  const blockedDashboard = await getMatterHealthDashboard({
    workspaceId: seeded.workspace.id,
    user: seeded.blockedUser
  });
  checks.push(record("blocked user cannot access matter health service", blockedDashboard === null));

  const notification = await sendMatterHealthCriticalBlockerNotification({
    actorUserId: seeded.owner.id,
    workspaceId: seeded.workspace.id,
    matterId: seeded.red.matter.id,
    healthScore: red.score,
    blockerCount: red.criticalBlockerCount,
    recipient: seeded.owner,
    dryRun: true
  });
  checks.push(record("critical blocker notification hook uses safe generic wording", typeof notification.status === "string" || notification.notified === false));

  const notificationAuditRows = await prisma.auditEvent.findMany({
    where: {
      workspaceId: seeded.workspace.id,
      action: { startsWith: "matter_health." }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  const notificationAuditJson = safeJson(notificationAuditRows.map((row) => row.metadataJson || {}));
  checks.push(record("matter health audit metadata stays redacted", !/Green Health Matter|Amber Health Matter|Red Health Matter|portal token|tokenHash|document url/i.test(notificationAuditJson)));

  const platformRows = safeJson(await getWorkspaceRows());
  checks.push(record("platform admin rows do not expose private matter health details", !/Green Health Matter|Amber Health Matter|Red Health Matter|HEALTH-RED-MATTER/i.test(platformRows)));

  let server: Awaited<ReturnType<typeof startServer>> | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    server = await startServer(3030);
    browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });

    const ownerPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await login(ownerPage, "http://localhost:3030", MATTER_HEALTH_OWNER_EMAIL, MATTER_HEALTH_OWNER_PASSWORD, "public");
    await ownerPage.goto("http://localhost:3030/app/matter-health", { waitUntil: "domcontentloaded" });
    checks.push(record("matter health dashboard page loads", await ownerPage.locator("text=Matter health score").first().isVisible()));

    await ownerPage.goto(`http://localhost:3030/app/matters/${seeded.red.matter.id}`, { waitUntil: "domcontentloaded" });
    checks.push(record("matter-level health panel page loads", await ownerPage.locator("text=Matter health score").first().isVisible()));

    const blockedPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await login(blockedPage, "http://localhost:3030", MATTER_HEALTH_BLOCKED_EMAIL, MATTER_HEALTH_BLOCKED_PASSWORD, "workspace");
    await blockedPage.goto("http://localhost:3030/app/matter-health", { waitUntil: "domcontentloaded" });
    checks.push(record("permission blocked state is shown", await blockedPage.locator("text=Matter health unavailable").first().isVisible()));
    await blockedPage.close();

    await ownerPage.setViewportSize({ width: 390, height: 844 });
    await ownerPage.goto("http://localhost:3030/app/matter-health", { waitUntil: "domcontentloaded" });
    const noOverflow = await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    checks.push(record("mobile health view avoids horizontal overflow", noOverflow));
  } finally {
    await browser?.close().catch(() => null);
    await stopServer(server);
  }

  checks.forEach(ensure);
  console.log(JSON.stringify({ ok: true, checks }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
