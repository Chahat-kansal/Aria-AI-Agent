import { chromium } from "playwright-core";
import { prisma } from "@/lib/prisma";
import {
  completeDeadline,
  createDeadline,
  getDeadlineDashboard,
  getDeadlineReminderPreview,
  sendReminderForDeadlineItem,
  updateDeadline
} from "@/lib/services/deadlines/deadline-service";
import { DEADLINE_REVIEW_WARNING } from "@/lib/services/deadlines/deadline-policy";
import { getWorkspaceRows, safeJson } from "@/lib/services/platform-admin-data";
import {
  chromiumExecutable,
  DEADLINE_OWNER_EMAIL,
  DEADLINE_OWNER_PASSWORD,
  restoreDefaultDeadlineOwnerPermissions,
  setDeadlineOwnerPermissionsBlocked,
  login,
  seedDeadlineWorkspace,
  startServer,
  stopServer
} from "@/scripts/helpers/deadline-command-centre-proof";

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
  const seeded = await seedDeadlineWorkspace();
  const checks: Check[] = [];

  const dashboard = await getDeadlineDashboard({
    workspaceId: seeded.workspace.id,
    user: seeded.owner
  });

  checks.push(record("deadline dashboard includes overdue deadlines", dashboard.summary.overdue >= 1));
  checks.push(record("deadline dashboard includes urgent deadlines", dashboard.summary.urgent >= 1));
  checks.push(record("deadline dashboard includes upcoming deadlines", dashboard.summary.upcoming >= 1));
  checks.push(record("deadline dashboard includes missing evidence deadlines", dashboard.summary.missingEvidence >= 1));
  checks.push(record("review-required warning is retained", DEADLINE_REVIEW_WARNING.includes("Agent review")));

  const created = await createDeadline({
    workspaceId: seeded.workspace.id,
    actor: seeded.owner,
    data: {
      matterId: seeded.matterPrimary.id,
      assignedToUserId: seeded.agent.id,
      title: "Manual follow-up deadline",
      safeSummary: "Internal checklist follow-up.",
      dueAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      category: "manual",
      reviewRequired: true,
      clientVisible: false
    }
  });
  checks.push(record("manual deadline creation works", Boolean(created.id)));

  const updated = await updateDeadline({
    workspaceId: seeded.workspace.id,
    actor: seeded.owner,
    data: {
      deadlineId: created.id,
      title: "Manual follow-up deadline updated",
      safeSummary: "Updated summary.",
      category: "review_required"
    }
  });
  checks.push(record("manual deadline update works", updated.title.includes("updated")));

  const completed = await completeDeadline({
    workspaceId: seeded.workspace.id,
    actor: seeded.owner,
    deadlineId: created.id
  });
  checks.push(record("manual deadline complete works", completed.status === "COMPLETED"));

  const refreshed = await getDeadlineDashboard({
    workspaceId: seeded.workspace.id,
    user: seeded.owner
  });
  const missingEvidenceItem = refreshed.items.find((item) => item.category === "missing_evidence" && item.clientId === seeded.clientPrimary.id && item.status === "OPEN");
  const optOutItem = refreshed.items.find((item) => item.clientId === seeded.clientOptOut.id && item.category === "missing_evidence" && item.status === "OPEN");
  const consentMissingItem = refreshed.items.find((item) => item.clientId === seeded.clientConsentMissing.id && item.category === "missing_evidence" && item.status === "OPEN");
  const calculatedItem = refreshed.items.find((item) => item.kind !== "manual" && item.reviewRequired);

  checks.push(record("calculated or suggested deadline exists", Boolean(calculatedItem)));
  if (!missingEvidenceItem || !optOutItem || !consentMissingItem) {
    throw new Error("Required seeded deadline items were not found.");
  }

  const preview = await getDeadlineReminderPreview({
    workspaceId: seeded.workspace.id,
    user: seeded.owner,
    itemId: missingEvidenceItem.id
  });
  checks.push(record("generic reminder preview is safe", preview.preview.body.includes("secure client portal") && !preview.preview.body.toLowerCase().includes("passport")));

  const optOutPreview = await getDeadlineReminderPreview({
    workspaceId: seeded.workspace.id,
    user: seeded.owner,
    itemId: optOutItem.id
  });
  checks.push(record("opt-out blocked state is honest", optOutPreview.preview.blockedReason === "Client opted out of non-essential reminders."));

  const consentMissingPreview = await getDeadlineReminderPreview({
    workspaceId: seeded.workspace.id,
    user: seeded.owner,
    itemId: consentMissingItem.id
  });
  checks.push(record("consent missing blocked state is honest", consentMissingPreview.preview.blockedReason === "Consent/preferences not recorded."));

  const reminderSend = await sendReminderForDeadlineItem({
    workspaceId: seeded.workspace.id,
    user: seeded.owner,
    itemId: missingEvidenceItem.id,
    channel: "portal"
  });
  checks.push(record("manual reminder send works", reminderSend.delivered === true));

  const rateLimitedSend = await sendReminderForDeadlineItem({
    workspaceId: seeded.workspace.id,
    user: seeded.owner,
    itemId: missingEvidenceItem.id,
    channel: "portal"
  });
  checks.push(record("rate limiting blocks repeated reminders", rateLimitedSend.delivered === false && String(rateLimitedSend.reason).toLowerCase().includes("rate")));

  const platformRowsJson = safeJson(await getWorkspaceRows());
  checks.push(record("platform admin rows do not expose deadline titles", !platformRowsJson.includes("Manual follow-up deadline updated") && !platformRowsJson.includes("Collect final review checklist")));

  const auditEvents = await prisma.auditEvent.findMany({
    where: { workspaceId: seeded.workspace.id, action: { startsWith: "deadline." } },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  const auditJson = safeJson(auditEvents.map((event) => event.metadataJson || {}));
  checks.push(record("deadline audit metadata stays redacted", !auditJson.includes("Manual follow-up deadline updated")));

  let server: Awaited<ReturnType<typeof startServer>> | null = null;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    console.log("Phase 13 readiness: starting local server");
    server = await startServer(3028);
    console.log("Phase 13 readiness: launching browser");
    browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });

    const ownerPage = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    console.log("Phase 13 readiness: owner login");
    await login(ownerPage, "http://localhost:3028", DEADLINE_OWNER_EMAIL, DEADLINE_OWNER_PASSWORD);
    console.log("Phase 13 readiness: owner dashboard");
    await ownerPage.goto("http://localhost:3028/app/deadlines", { waitUntil: "domcontentloaded" });
    checks.push(record("deadline dashboard page loads", await ownerPage.locator("text=Deadline command centre").first().isVisible()));
    console.log("Phase 13 readiness: owner matter panel");
    checks.push(record("matter-level deadline panel loads", await ownerPage.goto(`http://localhost:3028/app/matters/${seeded.matterPrimary.id}`, { waitUntil: "domcontentloaded" }).then(async () => ownerPage.locator("text=Matter deadline panel").first().isVisible())));

    console.log("Phase 13 readiness: blocked-state page");
    await setDeadlineOwnerPermissionsBlocked(seeded.owner.id);
    try {
      await ownerPage.goto("http://localhost:3028/app/deadlines", { waitUntil: "domcontentloaded" });
      checks.push(record("permission blocked state is shown", await ownerPage.locator("text=Deadline command centre unavailable").first().isVisible()));
    } finally {
      await restoreDefaultDeadlineOwnerPermissions(seeded.owner.id);
    }

    console.log("Phase 13 readiness: mobile dashboard");
    await ownerPage.setViewportSize({ width: 390, height: 844 });
    await ownerPage.goto("http://localhost:3028/app/deadlines", { waitUntil: "domcontentloaded" });
    const mobileWidth = await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    checks.push(record("mobile deadline view avoids horizontal overflow", mobileWidth));
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
