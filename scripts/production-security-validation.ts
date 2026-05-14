import fs from "node:fs/promises";
import path from "node:path";
import { ExtractionStatus, FieldStatus, MatterStage, MatterStatus, ReviewStatus, UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessMatter } from "@/lib/services/roles";

const WORKSPACE_SLUG = "aria-privacy-qa-workspace";
const RESULT = {
  target: process.env.PRODUCTION_URL || null,
  publicSurfaceChecked: false,
  loggedOutPrivateRoutesProtected: false,
  buildInfoSafe: false,
  htmlAndRscPayloadsClean: false,
  jsonApiPayloadsClean: false,
  publicBundlesClean: false,
  privateCacheHeadersSafe: false,
  browserStorageRiskChecked: false,
  agentIsolationPass: false,
  platformRedactionPass: false,
  auditMetadataRedactionPass: false,
  aiContextStaticScopingPass: false,
  exportRouteScopedAndNoStore: false,
  generatedFileRoutesScopedAndNoStore: false,
  emailPayloadStaticMinimizationPass: false,
  thirdPartyNoClientDataStaticPass: false,
  legacyRawReviewTokenFallbackRemoved: false,
  sensitiveDownloadsNoStore: false,
  baselineHeadersConfigured: false,
  canariesHiddenFromPlatformAdmin: false
};

const PUBLIC_SECRET_PATTERNS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "APP_FIELD_ENCRYPTION_KEY",
  "CRON_SECRET",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "tokenHash"
];

async function readRepoFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf8");
}

async function validatePublicSurface() {
  if (!RESULT.target) return;
  const base = RESULT.target.replace(/\/+$/, "");
  const paths = [
    "/api/build-info",
    "/app/overview",
    "/app/matters",
    "/app/documents",
    "/app/settings/security/launch-readiness",
    "/admin",
    "/admin/workspaces",
    "/admin/audit",
    "/api/documents/guess-document-id/download",
    "/api/settings/data/export-folder?matterId=guess-matter-id",
    "/client-review/invalid-token-security-test"
  ];

  const responses = await Promise.all(paths.map(async (route) => {
    const response = await fetch(`${base}${route}`, { redirect: "manual" });
    const text = await response.text().catch(() => "");
    const headers = Object.fromEntries(response.headers.entries());
    return { route, status: response.status, text, headers };
  }));

  const privateRoutes = responses.filter((item) => item.route !== "/api/build-info");
  RESULT.publicSurfaceChecked = true;
  RESULT.loggedOutPrivateRoutesProtected = privateRoutes.every((item) =>
    [200, 301, 302, 303, 307, 308, 401, 403, 404, 405].includes(item.status) &&
    !PUBLIC_SECRET_PATTERNS.some((pattern) => item.text.includes(pattern))
  );

  const buildInfo = responses.find((item) => item.route === "/api/build-info");
  RESULT.buildInfoSafe = Boolean(
    buildInfo &&
    buildInfo.status < 500 &&
    !PUBLIC_SECRET_PATTERNS.some((pattern) => buildInfo.text.includes(pattern))
  );
  RESULT.htmlAndRscPayloadsClean = privateRoutes.every((item) => ![
    "ARIA-QA-",
    "storageKey",
    "sourceSnippet",
    "fieldValue",
    "passportNumber",
    "visaGrantNumber"
  ].some((pattern) => item.text.includes(pattern)));
  RESULT.jsonApiPayloadsClean = privateRoutes
    .filter((item) => item.route.startsWith("/api/"))
    .every((item) => !["tokenHash", "storageKey", "sourceSnippet", "fieldValue", "rawDocumentUrl"].some((pattern) => item.text.includes(pattern)));
  RESULT.privateCacheHeadersSafe = privateRoutes
    .filter((item) => item.route.startsWith("/api/"))
    .every((item) => {
      const cache = item.headers["cache-control"] ?? "";
      return item.status >= 300 || /no-store|private/i.test(cache);
    });
}

async function validateLocalPrivacyModel() {
  process.env.PLATFORM_ADMIN_EMAILS = "platform-admin-privacy-qa@example.com";
  const { encryptString } = await import("@/lib/security/encryption");
  const { getWorkspaceRows, getAuditRows, safeJson } = await import("@/lib/services/platform-admin-data");
  const { auditPlatformAdminAction } = await import("@/lib/services/platform-admin");

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Aria Privacy QA Workspace", plan: WorkspacePlan.PRO },
    create: { name: "Aria Privacy QA Workspace", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO }
  });

  const [owner, admin, agentOne, agentTwo] = await Promise.all([
    prisma.user.upsert({
      where: { email: "owner-privacy-qa@example.com" },
      update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER, visibilityScope: UserVisibilityScope.FIRM_WIDE },
      create: { workspaceId: workspace.id, name: "Privacy QA Owner", email: "owner-privacy-qa@example.com", status: UserStatus.ACTIVE, role: UserRole.COMPANY_OWNER, visibilityScope: UserVisibilityScope.FIRM_WIDE }
    }),
    prisma.user.upsert({
      where: { email: "admin-privacy-qa@example.com" },
      update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.COMPANY_ADMIN, visibilityScope: UserVisibilityScope.FIRM_WIDE },
      create: { workspaceId: workspace.id, name: "Privacy QA Admin", email: "admin-privacy-qa@example.com", status: UserStatus.ACTIVE, role: UserRole.COMPANY_ADMIN, visibilityScope: UserVisibilityScope.FIRM_WIDE }
    }),
    prisma.user.upsert({
      where: { email: "agent-one-privacy-qa@example.com" },
      update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY },
      create: { workspaceId: workspace.id, name: "Privacy QA Agent One", email: "agent-one-privacy-qa@example.com", status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY }
    }),
    prisma.user.upsert({
      where: { email: "agent-two-privacy-qa@example.com" },
      update: { workspaceId: workspace.id, status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY },
      create: { workspaceId: workspace.id, name: "Privacy QA Agent Two", email: "agent-two-privacy-qa@example.com", status: UserStatus.ACTIVE, role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY }
    })
  ]);

  const clientA = await prisma.client.upsert({
    where: { clientReference: "privacy-qa-client-a" },
    update: { workspaceId: workspace.id, assignedToUserId: agentOne.id, notes: encryptString("ARIA-QA-A-REDACTED-CANARY") },
    create: {
      workspaceId: workspace.id,
      assignedToUserId: agentOne.id,
      clientReference: "privacy-qa-client-a",
      firstName: "Client",
      lastName: "One",
      dob: new Date("1990-01-01T00:00:00.000Z"),
      nationality: "Dummy",
      email: "client-one-privacy-qa@example.com",
      phone: "0400000001",
      notes: encryptString("ARIA-QA-A-REDACTED-CANARY")
    }
  });
  const clientB = await prisma.client.upsert({
    where: { clientReference: "privacy-qa-client-b" },
    update: { workspaceId: workspace.id, assignedToUserId: agentTwo.id, notes: encryptString("ARIA-QA-B-REDACTED-CANARY") },
    create: {
      workspaceId: workspace.id,
      assignedToUserId: agentTwo.id,
      clientReference: "privacy-qa-client-b",
      firstName: "Client",
      lastName: "Two",
      dob: new Date("1991-01-01T00:00:00.000Z"),
      nationality: "Dummy",
      email: "client-two-privacy-qa@example.com",
      phone: "0400000002",
      notes: encryptString("ARIA-QA-B-REDACTED-CANARY")
    }
  });

  const matterA = await prisma.matter.create({
    data: { workspaceId: workspace.id, clientId: clientA.id, assignedToUserId: agentOne.id, title: "Privacy QA Matter A", visaSubclass: "500", visaStream: "Student", status: MatterStatus.IN_PROGRESS, stage: MatterStage.INTAKE, readinessScore: 0 }
  });
  const matterB = await prisma.matter.create({
    data: { workspaceId: workspace.id, clientId: clientB.id, assignedToUserId: agentTwo.id, title: "Privacy QA Matter B", visaSubclass: "485", visaStream: "Graduate", status: MatterStatus.IN_PROGRESS, stage: MatterStage.INTAKE, readinessScore: 0 }
  });

  const documentB = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      clientId: clientB.id,
      matterId: matterB.id,
      fileName: "privacy-qa-doc-b.pdf",
      storageKey: "privacy-qa/redacted/doc-b",
      mimeType: "application/pdf",
      fileSize: 100,
      category: "Identity",
      uploadedByUserId: agentTwo.id,
      extractionStatus: ExtractionStatus.EXTRACTED,
      reviewStatus: ReviewStatus.PENDING
    }
  });
  await prisma.extractedField.create({
    data: {
      matterId: matterB.id,
      documentId: documentB.id,
      fieldKey: "privacy.qa.canary",
      fieldLabel: "Privacy QA canary",
      fieldValue: encryptString("ARIA-QA-DOC-B-REDACTED-CANARY"),
      sourceSnippet: encryptString("ARIA-QA-B-SNIPPET-REDACTED-CANARY"),
      sourcePageRef: encryptString("page 1"),
      confidence: 0.9,
      status: FieldStatus.NEEDS_REVIEW,
      needsReview: true
    }
  });

  await auditPlatformAdminAction(owner, "privacy.qa.redaction", {
    tokenHash: "ARIA-QA-TOKEN-HASH-REDACTED-CANARY",
    extractedText: "ARIA-QA-EXTRACTED-REDACTED-CANARY",
    fileName: "ARIA-QA-CLIENT-NAMED-FILE-REDACTED-CANARY.pdf",
    rawDocumentUrl: "https://storage.example.invalid/ARIA-QA-RAW-URL-REDACTED-CANARY",
    storageKey: "ARIA-QA-STORAGE-KEY-REDACTED-CANARY",
    draftFieldValue: "ARIA-QA-DRAFT-FIELD-REDACTED-CANARY",
    visaGrantNumber: "ARIA-QA-GRANT-REDACTED-CANARY",
    dob: "1990-01-01",
    address: "ARIA-QA-ADDRESS-REDACTED-CANARY",
    phone: "ARIA-QA-PHONE-REDACTED-CANARY",
    email: "aria-qa-email-redacted@example.com",
    portalSubmission: "ARIA-QA-PORTAL-SUBMISSION-REDACTED-CANARY",
    aiPrompt: "ARIA-QA-AI-PROMPT-REDACTED-CANARY",
    aiResponse: "ARIA-QA-AI-RESPONSE-REDACTED-CANARY",
    safeCount: 2
  });

  RESULT.agentIsolationPass =
    canAccessMatter(agentOne, { workspaceId: workspace.id, assignedToUserId: agentOne.id }) &&
    !canAccessMatter(agentOne, { workspaceId: workspace.id, assignedToUserId: agentTwo.id }) &&
    canAccessMatter(agentTwo, { workspaceId: workspace.id, assignedToUserId: agentTwo.id }) &&
    !canAccessMatter(agentTwo, { workspaceId: workspace.id, assignedToUserId: agentOne.id }) &&
    canAccessMatter(admin, { workspaceId: workspace.id, assignedToUserId: agentOne.id }) &&
    canAccessMatter(owner, { workspaceId: workspace.id, assignedToUserId: agentTwo.id });

  const platformText = safeJson({
    workspaces: await getWorkspaceRows(),
    audits: await getAuditRows({ workspaceId: workspace.id }, 20)
  });
  RESULT.platformRedactionPass = ![
    "ARIA-QA-A-REDACTED-CANARY",
    "ARIA-QA-B-REDACTED-CANARY",
    "ARIA-QA-DOC-B-REDACTED-CANARY",
    "ARIA-QA-B-SNIPPET-REDACTED-CANARY",
    "ARIA-QA-TOKEN-HASH-REDACTED-CANARY",
    "ARIA-QA-EXTRACTED-REDACTED-CANARY",
    "ARIA-QA-CLIENT-NAMED-FILE-REDACTED-CANARY",
    "ARIA-QA-RAW-URL-REDACTED-CANARY",
    "ARIA-QA-STORAGE-KEY-REDACTED-CANARY",
    "ARIA-QA-DRAFT-FIELD-REDACTED-CANARY",
    "ARIA-QA-GRANT-REDACTED-CANARY",
    "ARIA-QA-ADDRESS-REDACTED-CANARY",
    "ARIA-QA-PHONE-REDACTED-CANARY",
    "aria-qa-email-redacted@example.com",
    "ARIA-QA-PORTAL-SUBMISSION-REDACTED-CANARY",
    "ARIA-QA-AI-PROMPT-REDACTED-CANARY",
    "ARIA-QA-AI-RESPONSE-REDACTED-CANARY"
  ].some((value) => platformText.includes(value));
  RESULT.canariesHiddenFromPlatformAdmin = RESULT.platformRedactionPass;
  RESULT.auditMetadataRedactionPass = RESULT.platformRedactionPass;
}

async function validateSourceHardening() {
  const [
    clientReviewPage,
    reviewPatchRoute,
    reviewPdfRoute,
    matterDraftPage,
    documentDownloadRoute,
    exportRoute,
    formDraftDownloadRoute,
    nextConfig,
    generatedDocumentDownloadRoute,
    assistantRoute,
    assistantService,
    formsSyncService,
    migrationIntelService
  ] = await Promise.all([
    readRepoFile("app/client-review/[requestId]/page.tsx"),
    readRepoFile("app/api/review-requests/[requestId]/route.ts"),
    readRepoFile("app/api/client-review/[requestId]/draft-pdf/route.ts"),
    readRepoFile("app/app/matters/[matterId]/draft/page.tsx"),
    readRepoFile("app/api/documents/[documentId]/download/route.ts"),
    readRepoFile("app/api/settings/data/export-folder/route.ts"),
    readRepoFile("app/api/forms/drafts/[draftId]/download/route.ts"),
    readRepoFile("next.config.mjs"),
    readRepoFile("app/api/generated-documents/[documentId]/download/route.ts"),
    readRepoFile("app/api/assistant/route.ts"),
    readRepoFile("lib/services/aria-intelligence.ts"),
    readRepoFile("lib/services/official-forms-sync.ts"),
    readRepoFile("lib/services/migration-intel.ts").catch(() => "")
  ]);

  RESULT.legacyRawReviewTokenFallbackRemoved =
    !clientReviewPage.includes("{ publicToken: params.requestId }") &&
    !reviewPatchRoute.includes("{ publicToken: params.requestId }") &&
    !reviewPdfRoute.includes("{ publicToken: params.requestId }") &&
    !matterDraftPage.includes("href={`/client-review/${request.publicToken}`");

  RESULT.sensitiveDownloadsNoStore =
    documentDownloadRoute.includes('"Cache-Control": "private, no-store"') &&
    exportRoute.includes('"Cache-Control": "private, no-store"') &&
    formDraftDownloadRoute.includes('"Cache-Control": "private, no-store"');
  RESULT.exportRouteScopedAndNoStore =
    exportRoute.includes("hasPermission(context.user, \"can_export_data\")") &&
    exportRoute.includes("canAccessMatter(context.user, matter)") &&
    exportRoute.includes('"Cache-Control": "private, no-store"') &&
    !exportRoute.includes("storageKey");
  RESULT.generatedFileRoutesScopedAndNoStore =
    generatedDocumentDownloadRoute.includes("canAccessMatter(context.user, generatedDocument.matter)") &&
    generatedDocumentDownloadRoute.includes('"Cache-Control": "private, no-store"') &&
    formDraftDownloadRoute.includes("canAccessMatter(context.user, draft.matter)") &&
    formDraftDownloadRoute.includes('"Cache-Control": "private, no-store"');

  RESULT.baselineHeadersConfigured =
    nextConfig.includes("X-Content-Type-Options") &&
    nextConfig.includes("X-Frame-Options") &&
    nextConfig.includes("Referrer-Policy") &&
    nextConfig.includes("Permissions-Policy") &&
    nextConfig.includes("Content-Security-Policy");
  RESULT.publicBundlesClean =
    !(await scanFilesForSensitivePatterns([".next/static", "public"], ["ARIA-QA-"])) &&
    !(await scanPublicBundlesForConfiguredSecretValues());
  RESULT.browserStorageRiskChecked = !(await scanFilesForSensitivePatterns(["app", "components", "lib"], [
    "localStorage.setItem(\"document",
    "localStorage.setItem('document",
    "localStorage.setItem(\"extracted",
    "localStorage.setItem('extracted",
    "sessionStorage.setItem(\"document",
    "sessionStorage.setItem('document",
    "indexedDB"
  ]));
  RESULT.aiContextStaticScopingPass =
    assistantRoute.includes("getCurrentWorkspaceContext") &&
    assistantService.includes("scopedMatterWhere") &&
    !assistantRoute.includes("storageObject") &&
    !assistantRoute.includes("storageKey");
  RESULT.emailPayloadStaticMinimizationPass = !(await scanFilesForSensitivePatterns([
    "lib/services/email.ts",
    "app/api/portal/[portalId]/route.ts",
    "app/api/intake/route.ts",
    "app/api/document-requests/route.ts",
    "app/api/document-requests/[requestId]/reminder/route.ts",
    "app/api/appointments/route.ts",
    "app/api/invoices/[invoiceId]/route.ts"
  ], [
    "passportNumber",
    "visaGrantNumber",
    "sourceSnippet",
    "extractedText",
    "draftFieldValue"
  ]));
  RESULT.thirdPartyNoClientDataStaticPass =
    !formsSyncService.includes("clientId") &&
    !formsSyncService.includes("matterId") &&
    !/fetch\([\s\S]*?(clientId|matterId|extractedText|sourceSnippet|fieldValue|storageKey)/.test(migrationIntelService) &&
    !/runWebResearch|searchWeb|webResearch/.test(migrationIntelService);
}

async function scanFilesForSensitivePatterns(roots: string[], patterns: string[], ignoreIncludes: string[] = []) {
  async function walk(folder: string): Promise<string[]> {
    try {
      const absolute = path.join(process.cwd(), folder);
      const stat = await fs.stat(absolute);
      if (stat.isFile()) return [folder];
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      const nested = await Promise.all(entries.map((entry) => {
        const child = path.join(folder, entry.name);
        if (entry.isDirectory()) return walk(child);
        return Promise.resolve([child]);
      }));
      return nested.flat();
    } catch {
      return [];
    }
  }
  const files = (await Promise.all(roots.map(walk))).flat()
    .filter((file) => /\.(js|mjs|css|html|json|txt|tsx|ts)$/.test(file))
    .filter((file) => !ignoreIncludes.some((ignored) => file.replaceAll("\\", "/").endsWith(ignored)));
  for (const file of files) {
    const text = await readRepoFile(file).catch(() => "");
    if (patterns.some((pattern) => text.includes(pattern))) return true;
  }
  return false;
}

async function scanPublicBundlesForConfiguredSecretValues() {
  const secretNames = [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXTAUTH_SECRET",
    "APP_FIELD_ENCRYPTION_KEY",
    "CRON_SECRET",
    "OPENAI_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY"
  ];
  const values = secretNames
    .map((name) => process.env[name])
    .filter((value): value is string => Boolean(value && value.length >= 16 && !value.includes("replace")));
  if (!values.length) return false;
  return scanFilesForSensitivePatterns([".next/static", "public"], values);
}

async function main() {
  await validateSourceHardening();
  await validateLocalPrivacyModel();
  await validatePublicSurface();
  const pass = Object.entries(RESULT)
    .filter(([key]) => key !== "target" && key !== "publicSurfaceChecked")
    .every(([, value]) => value === true || value === null);
  console.log(JSON.stringify({ pass, result: RESULT }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());
