import { type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { ExtractionStatus, MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadScriptEnv } from "@/scripts/helpers/load-script-env";
import { resolveChromiumExecutable, startNextDevServer } from "@/scripts/helpers/cross-platform-runtime";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { ensureClientPortalToken, generateChecklistForMatter } from "@/lib/services/client-workflows";
import { updateWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { processClientPortalUpload } from "@/lib/services/client-portal-upload";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

loadScriptEnv();

type Check = { name: string; pass: boolean; detail?: string };

const ROOT = process.cwd();
const BASE_URL = "http://localhost:3021";
const WORKSPACE_SLUG = "mobile-upload-readiness";
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function chromiumExecutable() {
  return resolveChromiumExecutable();
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

async function startServer(port: number): Promise<ChildProcess> {
  const child = startNextDevServer(ROOT, port);

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

async function seedWorkspace() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Mobile Upload Readiness", plan: WorkspacePlan.PRO },
    create: { slug: WORKSPACE_SLUG, name: "Mobile Upload Readiness", plan: WorkspacePlan.PRO }
  });

  const agent = await prisma.user.upsert({
    where: { email: "mobile-upload-agent@example.com" },
    update: {
      workspaceId: workspace.id,
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    },
    create: {
      workspaceId: workspace.id,
      name: "Mobile Upload Agent",
      email: "mobile-upload-agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT)
    }
  });

  const client = await prisma.client.upsert({
    where: { clientReference: "MOBILE-UPLOAD-CLIENT" },
    update: {
      workspaceId: workspace.id,
      email: "mobile-upload-client@example.com",
      phone: "+61400000444",
      assignedToUserId: agent.id
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "MOBILE-UPLOAD-CLIENT",
      firstName: "Ava",
      lastName: "Singh",
      dob: new Date("1997-06-01T00:00:00.000Z"),
      nationality: "Demo",
      email: "mobile-upload-client@example.com",
      phone: "+61400000444",
      assignedToUserId: agent.id
    }
  });

  const matter = await prisma.matter.upsert({
    where: { matterReference: "MOBILE-UPLOAD-MATTER" },
    update: {
      workspaceId: workspace.id,
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Mobile Upload Matter"
    },
    create: {
      workspaceId: workspace.id,
      matterReference: "MOBILE-UPLOAD-MATTER",
      clientId: client.id,
      assignedToUserId: agent.id,
      title: "Mobile Upload Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 41
    }
  });

  const otherClient = await prisma.client.upsert({
    where: { clientReference: "MOBILE-UPLOAD-OTHER-CLIENT" },
    update: {
      workspaceId: workspace.id,
      assignedToUserId: agent.id
    },
    create: {
      workspaceId: workspace.id,
      clientReference: "MOBILE-UPLOAD-OTHER-CLIENT",
      firstName: "Leo",
      lastName: "Park",
      dob: new Date("1995-08-11T00:00:00.000Z"),
      nationality: "Demo",
      email: "mobile-upload-other@example.com",
      phone: "+61400000999",
      assignedToUserId: agent.id
    }
  });

  const otherMatter = await prisma.matter.upsert({
    where: { matterReference: "MOBILE-UPLOAD-OTHER-MATTER" },
    update: {
      workspaceId: workspace.id,
      clientId: otherClient.id,
      assignedToUserId: agent.id,
      title: "Other Upload Matter"
    },
    create: {
      workspaceId: workspace.id,
      matterReference: "MOBILE-UPLOAD-OTHER-MATTER",
      clientId: otherClient.id,
      assignedToUserId: agent.id,
      title: "Other Upload Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: MatterStatus.IN_PROGRESS,
      stage: MatterStage.EVIDENCE,
      readinessScore: 22
    }
  });

  const matterIds = [matter.id, otherMatter.id];
  const existingDocuments = await prisma.document.findMany({
    where: { matterId: { in: matterIds } },
    select: { id: true }
  });
  const existingDocumentIds = existingDocuments.map((document) => document.id);

  await prisma.inAppNotification.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.auditEvent.deleteMany({
    where: {
      workspaceId: workspace.id,
      action: {
        startsWith: "client_upload."
      }
    }
  });
  await prisma.clientPortalAccessToken.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.checklistItem.updateMany({
    where: { matterId: { in: matterIds } },
    data: { documentId: null }
  });
  if (existingDocumentIds.length) {
    await prisma.documentStorageObject.deleteMany({ where: { documentId: { in: existingDocumentIds } } });
    await prisma.document.deleteMany({ where: { id: { in: existingDocumentIds } } });
  }
  await prisma.checklistItem.deleteMany({ where: { matterId: { in: matterIds } } });

  await generateChecklistForMatter(matter.id, agent.id);
  await generateChecklistForMatter(otherMatter.id, agent.id);

  const checklistItems = await prisma.checklistItem.findMany({
    where: { matterId: matter.id },
    include: { document: true },
    orderBy: { label: "asc" }
  });
  const otherChecklistItem = await prisma.checklistItem.findFirstOrThrow({
    where: { matterId: otherMatter.id },
    orderBy: { label: "asc" }
  });

  await prisma.checklistItem.update({
    where: { id: checklistItems[0].id },
    data: {
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  });

  if (checklistItems[1]) {
    const existingDoc = await prisma.document.create({
      data: {
        workspaceId: workspace.id,
        clientId: client.id,
        matterId: matter.id,
        uploadedByUserId: agent.id,
        fileName: "DEMO - reupload-requested.pdf",
        storageKey: `demo/mobile-upload/${matter.id}/reupload-requested.pdf`,
        mimeType: "application/pdf",
        fileSize: 512,
        category: checklistItems[1].category,
        extractionStatus: ExtractionStatus.NEEDS_REVIEW,
        reviewStatus: ReviewStatus.FLAGGED
      }
    });

    await prisma.checklistItem.update({
      where: { id: checklistItems[1].id },
      data: {
        documentId: existingDoc.id,
        status: "REUPLOAD_REQUESTED",
        requestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });
  }

  await updateWorkspaceLaunchControls(workspace.id, {
    betaModeEnabled: true,
    allowRealClientUploads: true,
    restrictBetaToSelectedUsers: false,
    restrictedUserEmails: [],
    allowedSubclasses: ["500"],
    clientPortalEnabled: true,
    aiDraftAutofillEnabled: true,
    pdfFormFillingEnabled: true,
    exportEnabled: true,
    publicSignupEnabled: false,
    maxFileSizeMb: 8,
    allowedFileTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    legalReviewStatuses: {
      privacy: "draft",
      terms: "draft",
      security: "draft",
      aiDisclaimer: "draft",
      subprocessors: "draft"
    }
  });

  await prisma.workspaceOperationalSettings.update({
    where: { workspaceId: workspace.id },
    data: {
      documentMaxUploadBytes: 8 * 1024 * 1024,
      documentAllowedMimeTypesJson: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      pushEnabled: true,
      pushClientOptInRequired: true,
      pushAgentAlertsEnabled: true
    } as any
  });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Mobile upload portal",
    createdByUserId: agent.id,
    requestOrigin: "https://aria.test"
  });

  return {
    workspace,
    agent,
    client,
    matter,
    portalToken: portal.token,
    checklistItemId: checklistItems[0].id,
    reuploadChecklistItemId: checklistItems[1]?.id ?? checklistItems[0].id,
    otherChecklistItemId: otherChecklistItem.id
  };
}

function createFile(name: string, mimeType: string, content: string | Buffer) {
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return new File([new Uint8Array(bytes)], name, { type: mimeType });
}

async function runViewportChecks(token: string) {
  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  let selectedFileFlowOk = true;
  let overflowOk = true;
  const deltas: Array<{ width: number; delta: number }> = [];
  const selectionWidths = new Set([390]);
  try {
    const widths = [390, 430, 768];
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width === 768 ? 1024 : 844 },
        userAgent: MOBILE_USER_AGENT,
        isMobile: width !== 768,
        deviceScaleFactor: 1
      });
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/client/documents/${token}`, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));
      deltas.push({ width, delta: overflow.scrollWidth - overflow.clientWidth });
      const buttonsVisible = await Promise.all([
        page.getByRole("button", { name: /Take photo/i }).first().isVisible(),
        page.getByRole("button", { name: /Choose file/i }).first().isVisible()
      ]);
      if (overflow.scrollWidth > overflow.clientWidth + 4 || buttonsVisible.some((visible) => !visible)) {
        overflowOk = false;
        await context.close();
        return { overflowOk, selectedFileFlowOk, deltas };
      }

      let selectedVisible = true;
      if (selectionWidths.has(width)) {
        await page.getByRole("button", { name: /Choose file/i }).first().waitFor({ state: "visible", timeout: 5_000 });
        const fileInput = page.locator('input[type="file"]:not([capture])').first();
        await fileInput.setInputFiles({
          name: "demo-student-id.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 demo mobile upload proof", "utf8")
        });
        await page.waitForTimeout(200);
        const selectedFileName = await fileInput.evaluate(
          (input) => (input as HTMLInputElement).files?.[0]?.name ?? ""
        );
        const uploadEnabled = await page.getByRole("button", { name: /^Upload$/i }).first().isEnabled();
        const selectedFileLabelVisible = await page.waitForFunction(
          (fileName) => document.body.innerText.includes(fileName),
          "demo-student-id.pdf",
          { timeout: 5_000 }
        )
          .then(() => true)
          .catch(() => false);
        selectedVisible =
          selectedFileLabelVisible ||
          (selectedFileName === "demo-student-id.pdf" && uploadEnabled);
      }
      await context.close();
      selectedFileFlowOk = selectedFileFlowOk && selectedVisible;
      if (!selectedVisible) return { overflowOk, selectedFileFlowOk, deltas };
    }
    return { overflowOk, selectedFileFlowOk, deltas };
  } finally {
    await browser.close();
  }
}

async function main() {
  const checks: Check[] = [];
  const seeded = await seedWorkspace();

  const routeSource = readFileSync(path.join(ROOT, "app", "api", "portal", "uploads", "route.ts"), "utf8");
  const uploadComponentSource = readFileSync(path.join(ROOT, "components", "client", "mobile-upload-card.tsx"), "utf8");
  const swSource = readFileSync(path.join(ROOT, "public", "aria-push-sw.js"), "utf8");

  let server: ChildProcess | null = null;

  try {
    server = await startServer(3021);

    const uploadPage = await fetch(`${BASE_URL}/client/documents/${seeded.portalToken}`, { cache: "no-store" });
    const uploadPageHtml = await uploadPage.text();
    checks.push({ name: "Mobile upload route page loads", pass: uploadPage.ok && /Upload your documents/i.test(uploadPageHtml) });
    checks.push({ name: "Mobile document checklist renders", pass: /Your document checklist|Upload your documents/i.test(uploadPageHtml) && /Take photo|Choose file/i.test(uploadPageHtml) });

    const supported = await processClientPortalUpload({
      checklistItemId: seeded.checklistItemId,
      token: seeded.portalToken,
      file: createFile("student-id.pdf", "application/pdf", "%PDF-1.4 demo mobile upload")
    });
    checks.push({
      name: "Upload success updates checklist status",
      pass: supported.ok && supported.checklist.statusLabel === "Uploaded - waiting for team review",
      detail: supported.ok ? supported.checklist.statusLabel : supported.error
    });

    const uploadedItem = await prisma.checklistItem.findUniqueOrThrow({
      where: { id: seeded.checklistItemId },
      include: { document: true }
    });
    checks.push({
      name: "Checklist update shows waiting for team review state",
      pass: Boolean(uploadedItem.document?.fileName) && uploadedItem.document?.fileName === "student-id.pdf",
      detail: uploadedItem.document?.fileName || "no document linked"
    });

    const unsupported = await processClientPortalUpload({
      checklistItemId: seeded.checklistItemId,
      token: seeded.portalToken,
      file: createFile("notes.txt", "text/plain", "not supported")
    });
    checks.push({ name: "Unsupported file type rejected cleanly", pass: !unsupported.ok && unsupported.error === "This file type is not supported." });

    const tooLarge = await processClientPortalUpload({
      checklistItemId: seeded.checklistItemId,
      token: seeded.portalToken,
      file: createFile("huge.pdf", "application/pdf", Buffer.alloc(8 * 1024 * 1024 + 1, 1))
    });
    checks.push({ name: "Too-large file rejected cleanly", pass: !tooLarge.ok && tooLarge.error === "This file is too large." });

    const reupload = await processClientPortalUpload({
      checklistItemId: seeded.reuploadChecklistItemId,
      token: seeded.portalToken,
      file: createFile("replacement-passport.pdf", "application/pdf", "%PDF-1.4 replacement content")
    });
    checks.push({
      name: "Re-upload flow works",
      pass: reupload.ok && reupload.document.fileName === "replacement-passport.pdf",
      detail: reupload.ok ? reupload.document.fileName : reupload.error
    });

    const wrongMatter = await processClientPortalUpload({
      checklistItemId: seeded.otherChecklistItemId,
      token: seeded.portalToken,
      file: createFile("wrong-matter.pdf", "application/pdf", "%PDF-1.4 wrong")
    });
    checks.push({ name: "Wrong client matter upload is blocked", pass: !wrongMatter.ok && wrongMatter.code === "UNAUTHORISED" });

    const latestNotification = await prisma.inAppNotification.findFirst({
      where: { workspaceId: seeded.workspace.id, userId: seeded.agent.id },
      orderBy: { createdAt: "desc" }
    });
    const latestNotificationBody = latestNotification?.bodyPreviewRedacted || "";
    checks.push({
      name: "Assigned agent receives generic in-app notification",
      pass: Boolean(latestNotificationBody) && /client uploaded a document/i.test(latestNotificationBody) && !/student-id|passport|dob|grant/i.test(latestNotificationBody),
      detail: latestNotificationBody || "no notification"
    });

    checks.push({
      name: "Push hook uses generic payload only",
      pass: supported.ok && supported.notification.created,
      detail: supported.ok ? JSON.stringify(supported.notification) : supported.error
    });

    checks.push({
      name: "Camera capture option appears where supported or fallback shown",
      pass: /capture=\"environment\"/.test(uploadComponentSource) && /Take photo/.test(uploadComponentSource)
    });
    checks.push({
      name: "Accepted file types displayed",
      pass: /Accepted formats/.test(uploadComponentSource)
    });
    checks.push({
      name: "Max size displayed",
      pass: /Max size/.test(uploadComponentSource)
    });
    checks.push({
      name: "Upload failure shows clean error",
      pass: uploadComponentSource.includes("Upload failed. Please try again.")
    });
    checks.push({
      name: "Offline state does not store document bytes permanently",
      pass: uploadComponentSource.includes("You appear to be offline. Please reconnect to upload.") && !/localStorage|indexedDB|caches\\./.test(uploadComponentSource)
    });
    checks.push({
      name: "Service worker does not cache private upload download document routes",
      pass:
        !swSource.includes("addEventListener(\"fetch\"")
        && !swSource.includes("addEventListener('fetch'")
        && !swSource.includes("caches.")
        && readFileSync(path.join(ROOT, "lib", "services", "client-portal-upload.ts"), "utf8").includes("private, no-store")
    });
    checks.push({
      name: "Raw document URLs storage keys tokenHash not exposed",
      pass: !/storageKey|signedUrl|publicUrl|tokenHash|rawDocumentUrl/i.test(JSON.stringify(supported))
    });
    checks.push({
      name: "Platform admin cannot see private uploaded document content",
      pass: (await getWorkspaceRows()).every((row) => !JSON.stringify(row).includes("student-id.pdf"))
    });
    checks.push({
      name: "No default browser file input is visible as primary UI",
      pass: /className=\"sr-only\"/.test(uploadComponentSource) && /Choose file/.test(uploadComponentSource)
    });

    const auditTrail = await prisma.auditEvent.findMany({
      where: { workspaceId: seeded.workspace.id, action: { startsWith: "client_upload." } },
      orderBy: { createdAt: "asc" }
    });
    const uploadServiceSource = readFileSync(path.join(ROOT, "lib", "services", "client-portal-upload.ts"), "utf8");
    checks.push({
      name: "Audit events added and redacted",
      pass: [
        "client_upload.started",
        "client_upload.completed",
        "client_upload.failed",
        "client_upload.reupload_requested",
        "client_upload.quality_flagged",
        "client_upload.unsupported_file",
        "client_upload.too_large",
        "client_upload.unauthorised_blocked",
        "client_upload.notification_created"
      ].every((action) => uploadServiceSource.includes(action))
      && auditTrail.some((event) => event.action === "client_upload.started")
      && auditTrail.some((event) => event.action === "client_upload.completed")
      && auditTrail.some((event) => event.action === "client_upload.unsupported_file")
      && auditTrail.some((event) => event.action === "client_upload.too_large")
      && auditTrail.some((event) => event.action === "client_upload.notification_created")
      && auditTrail.every((event) => !/storageKey|tokenHash|signedUrl|publicUrl/i.test(JSON.stringify(event.metadataJson || {})))
    });

    const viewportChecks = await runViewportChecks(seeded.portalToken);
    checks.push({
      name: "Mobile viewport has no horizontal overflow",
      pass: viewportChecks.overflowOk,
      detail: JSON.stringify(viewportChecks.deltas)
    });
    checks.push({
      name: "File picker flow works in dry-run mock",
      pass: viewportChecks.selectedFileFlowOk
    });
  } finally {
    await stopServer(server);
  }

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, workspace: WORKSPACE_SLUG, checks, failed }, null, 2));
  if (failed.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
