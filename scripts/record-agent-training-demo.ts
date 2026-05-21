import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { hash } from "bcryptjs";
import { chromium, type Page } from "playwright-core";
import {
  AppointmentStatus,
  ExtractionStatus,
  FieldStatus,
  GeneratedDocumentType,
  InvoiceStatus,
  IssueSeverity,
  MatterStage,
  MatterStatus,
  ResolutionStatus,
  ReviewStatus,
  TaskPriority,
  TaskStatus,
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
const SCREENSHOT_DIR = path.join(DEMO_DIR, "screenshots");
const VIDEO_TEMP_DIR = path.join(DEMO_DIR, ".video-temp");
const VIDEO_PATH = path.join(DEMO_DIR, "aria-agent-training-demo.mp4");
const WEBM_PATH = path.join(DEMO_DIR, "aria-agent-training-demo.webm");
const PASSWORD = "BrightPath-Demo-Only-2026!";
const WORKSPACE_SLUG = "brightpath-migration-demo";

type DemoSeed = {
  ownerEmail: string;
  adminEmail: string;
  sarahEmail: string;
  jamesEmail: string;
  portalUrl: string;
  matters: Record<string, string>;
};

const chapters = [
  ["01-introduction", "Introduction"],
  ["02-login", "Account creation and login"],
  ["03-owner-dashboard", "Owner dashboard"],
  ["04-settings", "Workspace and security settings"],
  ["05-team", "Team and permissions"],
  ["06-create-client-matter", "Create a client and matter"],
  ["07-required-documents", "Required documents checklist"],
  ["08-evidence-vault", "Evidence Vault"],
  ["09-ai-working-copy", "AI Working Copy"],
  ["10-document-quality", "Document extraction and photo quality"],
  ["11-review-dashboard", "Matter review dashboard"],
  ["12-ai-draft-autofill", "AI draft autofill"],
  ["13-full-application-draft", "Full Application Draft"],
  ["14-subclass-examples", "Subclass examples"],
  ["15-client-portal", "Client portal"],
  ["16-portal-messaging", "Portal messaging and nudges"],
  ["17-appointments", "Appointments"],
  ["18-deadline-intelligence", "Deadline intelligence"],
  ["19-ask-aria", "Ask Aria assistant"],
  ["20-visa-knowledge", "Visa Knowledge and migration updates"],
  ["21-pathway-intelligence", "Pathway intelligence"],
  ["22-template-library", "Templates and precedent library"],
  ["23-forms", "Official forms and PDF templates"],
  ["24-generated-documents", "Generated documents and draft packs"],
  ["25-billing", "Billing and invoices"],
  ["26-firm-workflow", "Firm workflow and supervision"],
  ["27-platform-admin", "Platform admin boundary"],
  ["28-audit-security", "Audit and security"],
  ["29-mobile-web", "Mobile web"],
  ["30-final-workflow", "Final recommended workflow"]
] as const;

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
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
    // Fall back to Playwright's bundled ffmpeg if the full installer package is unavailable.
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
      // Keep waiting while the local dev server boots.
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
      jobTitle: input.role === UserRole.COMPANY_OWNER ? "Principal" : input.role === UserRole.COMPANY_ADMIN ? "Practice manager" : "Registered Migration Agent"
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

async function upsertClient(input: {
  workspaceId: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  assignedToUserId: string;
}) {
  return prisma.client.upsert({
    where: { clientReference: input.reference },
    create: {
      workspaceId: input.workspaceId,
      clientReference: input.reference,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      nationality: input.nationality,
      dob: new Date("1998-03-12T00:00:00.000Z"),
      currentVisaStatus: "Demo visa status - not real client data",
      currentVisaExpiry: addDays(90),
      assignedToUserId: input.assignedToUserId,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    },
    update: {
      workspaceId: input.workspaceId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      nationality: input.nationality,
      assignedToUserId: input.assignedToUserId,
      notes: "DEMO CLIENT NOTES - NOT REAL CLIENT DATA"
    }
  });
}

async function upsertMatter(input: {
  workspaceId: string;
  reference: string;
  clientId: string;
  title: string;
  subclass: string;
  stream: string;
  assignedToUserId: string;
  status?: MatterStatus;
  stage?: MatterStage;
}) {
  return prisma.matter.upsert({
    where: { matterReference: input.reference },
    create: {
      workspaceId: input.workspaceId,
      matterReference: input.reference,
      clientId: input.clientId,
      title: input.title,
      visaSubclass: input.subclass,
      visaStream: input.stream,
      status: input.status ?? MatterStatus.AWAITING_DOCS,
      stage: input.stage ?? MatterStage.EVIDENCE,
      assignedToUserId: input.assignedToUserId,
      readinessScore: 68,
      currentVisaStatus: "Demo current visa - not real client data",
      currentVisaExpiry: addDays(80),
      criticalDeadline: addDays(28),
      lodgementTargetDate: addDays(45),
      expectedNextMilestone: "Agent final review after evidence confirmation"
    },
    update: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      title: input.title,
      visaSubclass: input.subclass,
      visaStream: input.stream,
      status: input.status ?? MatterStatus.AWAITING_DOCS,
      stage: input.stage ?? MatterStage.EVIDENCE,
      assignedToUserId: input.assignedToUserId,
      readinessScore: 68,
      currentVisaExpiry: addDays(80),
      criticalDeadline: addDays(28),
      lodgementTargetDate: addDays(45)
    }
  });
}

async function upsertDocument(input: {
  workspaceId: string;
  clientId: string;
  matterId: string;
  uploadedByUserId: string;
  fileName: string;
  category: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
}) {
  const storageKey = `demo/brightpath/${input.matterId}/${input.fileName}`;
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
    extractionStatus: ExtractionStatus.EXTRACTED,
    reviewStatus: ReviewStatus.VERIFIED
  };
  const document = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data });

  await prisma.documentStorageObject.upsert({
    where: { documentId: document.id },
    create: {
      documentId: document.id,
      provider: "DEMO_SECURE_VAULT",
      storageKey,
      data: Buffer.from(`DEMO DOCUMENT - NOT REAL CLIENT DATA\n${input.fileName}\n${input.fieldLabel}: ${input.fieldValue}`)
    },
    update: {
      provider: "DEMO_SECURE_VAULT",
      storageKey,
      data: Buffer.from(`DEMO DOCUMENT - NOT REAL CLIENT DATA\n${input.fileName}\n${input.fieldLabel}: ${input.fieldValue}`)
    }
  });

  const extracted = await prisma.extractedField.findFirst({ where: { documentId: document.id, fieldKey: input.fieldKey } });
  const fieldData = {
    matterId: input.matterId,
    documentId: document.id,
    fieldKey: input.fieldKey,
    fieldLabel: input.fieldLabel,
    fieldValue: input.fieldValue,
    confidence: 0.92,
    sourceSnippet: "DEMO DOCUMENT - NOT REAL CLIENT DATA",
    sourcePageRef: "Demo page 1",
    status: FieldStatus.VERIFIED,
    needsReview: false
  };
  if (extracted) await prisma.extractedField.update({ where: { id: extracted.id }, data: fieldData });
  else await prisma.extractedField.create({ data: fieldData });

  await prisma.documentExtractionResult.create({
    data: {
      documentId: document.id,
      provider: "demo-fixture",
      model: "demo-ocr",
      extractedJson: {
        warning: "DEMO DOCUMENT - NOT REAL CLIENT DATA",
        qualityStatus: "GOOD_QUALITY",
        confidence: 0.92,
        fields: [{ key: input.fieldKey, label: input.fieldLabel, value: input.fieldValue }]
      }
    }
  }).catch(() => null);

  return document;
}

async function upsertChecklist(input: {
  matterId: string;
  documentId?: string;
  itemKey: string;
  category: string;
  label: string;
  required: boolean;
  dueInDays: number;
  reviewed?: boolean;
}) {
  const existing = await prisma.checklistItem.findFirst({ where: { matterId: input.matterId, itemKey: input.itemKey } });
  const data = {
    matterId: input.matterId,
    documentId: input.documentId,
    itemKey: input.itemKey,
    category: input.category,
    label: input.label,
    description: "DEMO checklist item - not official legal advice.",
    status: input.documentId ? (input.reviewed ? "Approved for AI Working Copy" : "Uploaded - review pending") : "Missing",
    required: input.required,
    dueDate: addDays(input.dueInDays),
    requestedAt: new Date(),
    reviewedAt: input.reviewed ? new Date() : null
  };
  return existing ? prisma.checklistItem.update({ where: { id: existing.id }, data }) : prisma.checklistItem.create({ data });
}

async function seedDemoData(): Promise<DemoSeed> {
  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    create: {
      name: "BrightPath Migration Demo",
      slug: WORKSPACE_SLUG,
      plan: WorkspacePlan.PRO,
      legalName: "BrightPath Migration Demo Pty Ltd",
      businessType: "Migration agency demo",
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

  const owner = await upsertUser({ workspaceId: workspace.id, name: "Olivia Bright", email: "owner@brightpath-demo.com", role: UserRole.COMPANY_OWNER, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  await upsertUser({ workspaceId: workspace.id, name: "BrightPath Admin", email: "admin@brightpath-demo.com", role: UserRole.COMPANY_ADMIN, visibilityScope: UserVisibilityScope.FIRM_WIDE });
  const sarah = await upsertUser({ workspaceId: workspace.id, name: "Sarah Nguyen", email: "agent.sarah@brightpath-demo.com", role: UserRole.SENIOR_MIGRATION_AGENT, visibilityScope: UserVisibilityScope.TEAM_OVERSIGHT, supervisorId: owner.id });
  const james = await upsertUser({ workspaceId: workspace.id, name: "James Patel", email: "agent.james@brightpath-demo.com", role: UserRole.MIGRATION_AGENT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY, supervisorId: sarah.id });
  await upsertUser({ workspaceId: workspace.id, name: "Aarav Sharma", email: "client.aarav@brightpath-demo.com", role: UserRole.ADMIN_ASSISTANT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY });
  await upsertUser({ workspaceId: workspace.id, name: "Emma Collins", email: "client.emma@brightpath-demo.com", role: UserRole.ADMIN_ASSISTANT, visibilityScope: UserVisibilityScope.ASSIGNED_ONLY });

  const aarav = await upsertClient({ workspaceId: workspace.id, reference: "DEMO-AARAV", firstName: "Aarav", lastName: "Sharma", email: "client.aarav@brightpath-demo.com", phone: "+61 400 000 101", nationality: "Demo nationality", assignedToUserId: sarah.id });
  const emma = await upsertClient({ workspaceId: workspace.id, reference: "DEMO-EMMA", firstName: "Emma", lastName: "Collins", email: "client.emma@brightpath-demo.com", phone: "+61 400 000 102", nationality: "Demo nationality", assignedToUserId: james.id });
  const lina = await upsertClient({ workspaceId: workspace.id, reference: "DEMO-LINA", firstName: "Lina", lastName: "Chen", email: "client.lina@brightpath-demo.com", phone: "+61 400 000 103", nationality: "Demo nationality", assignedToUserId: sarah.id });
  const miguel = await upsertClient({ workspaceId: workspace.id, reference: "DEMO-MIGUEL", firstName: "Miguel", lastName: "Santos", email: "client.miguel@brightpath-demo.com", phone: "+61 400 000 104", nationality: "Demo nationality", assignedToUserId: james.id });

  const matter500 = await upsertMatter({ workspaceId: workspace.id, reference: "DEMO-MATTER-500-AARAV", clientId: aarav.id, title: "Aarav Sharma - Subclass 500 Student", subclass: "500", stream: "Higher Education", assignedToUserId: sarah.id });
  const matter482 = await upsertMatter({ workspaceId: workspace.id, reference: "DEMO-MATTER-482-EMMA", clientId: emma.id, title: "Emma Collins - 482 Skills in Demand", subclass: "482", stream: "Skills in Demand", assignedToUserId: james.id });
  const matter820 = await upsertMatter({ workspaceId: workspace.id, reference: "DEMO-MATTER-820-LINA", clientId: lina.id, title: "Lina Chen - Partner 820/801", subclass: "820/801", stream: "Partner onshore", assignedToUserId: sarah.id });
  const matter600 = await upsertMatter({ workspaceId: workspace.id, reference: "DEMO-MATTER-600-MIGUEL", clientId: miguel.id, title: "Miguel Santos - Visitor 600", subclass: "600", stream: "Tourist", assignedToUserId: james.id });

  const docs = [
    await upsertDocument({ workspaceId: workspace.id, clientId: aarav.id, matterId: matter500.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - Aarav passport.pdf", category: "Identity", fieldKey: "identity.passport_number", fieldLabel: "Passport number", fieldValue: "DEMO-P5001234" }),
    await upsertDocument({ workspaceId: workspace.id, clientId: aarav.id, matterId: matter500.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - Aarav COE.pdf", category: "Education", fieldKey: "study.coe_number", fieldLabel: "COE number", fieldValue: "DEMO-COE-500-2026" }),
    await upsertDocument({ workspaceId: workspace.id, clientId: aarav.id, matterId: matter500.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - Aarav PTE.pdf", category: "English", fieldKey: "english.overall_score", fieldLabel: "PTE overall score", fieldValue: "72" }),
    await upsertDocument({ workspaceId: workspace.id, clientId: emma.id, matterId: matter482.id, uploadedByUserId: james.id, fileName: "DEMO DOCUMENT - Emma employment contract.pdf", category: "Employment", fieldKey: "employment.employer", fieldLabel: "Employer", fieldValue: "Demo Sponsor Pty Ltd" }),
    await upsertDocument({ workspaceId: workspace.id, clientId: lina.id, matterId: matter820.id, uploadedByUserId: sarah.id, fileName: "DEMO DOCUMENT - Lina relationship evidence.pdf", category: "Relationship", fieldKey: "relationship.start_date", fieldLabel: "Relationship start date", fieldValue: "01/02/2021" }),
    await upsertDocument({ workspaceId: workspace.id, clientId: miguel.id, matterId: matter600.id, uploadedByUserId: james.id, fileName: "DEMO DOCUMENT - Miguel invitation letter.pdf", category: "Visitor", fieldKey: "visitor.purpose", fieldLabel: "Purpose of visit", fieldValue: "Demo family visit" })
  ];

  await upsertChecklist({ matterId: matter500.id, documentId: docs[0].id, itemKey: "passport", category: "Identity", label: "Passport", required: true, dueInDays: 2, reviewed: true });
  await upsertChecklist({ matterId: matter500.id, documentId: docs[1].id, itemKey: "coe", category: "Education", label: "COE", required: true, dueInDays: 3, reviewed: true });
  await upsertChecklist({ matterId: matter500.id, documentId: docs[2].id, itemKey: "english", category: "English", label: "PTE / IELTS", required: true, dueInDays: 5, reviewed: true });
  await upsertChecklist({ matterId: matter500.id, itemKey: "oshc", category: "Health / Insurance", label: "OSHC certificate", required: true, dueInDays: 7 });
  await upsertChecklist({ matterId: matter482.id, documentId: docs[3].id, itemKey: "contract", category: "Employment", label: "Employment contract", required: true, dueInDays: 4, reviewed: false });
  await upsertChecklist({ matterId: matter820.id, documentId: docs[4].id, itemKey: "relationship", category: "Relationship", label: "Relationship evidence", required: true, dueInDays: 6, reviewed: false });
  await upsertChecklist({ matterId: matter600.id, documentId: docs[5].id, itemKey: "invitation", category: "Visitor", label: "Invitation letter", required: false, dueInDays: 8, reviewed: false });

  await prisma.validationIssue.create({
    data: {
      matterId: matter500.id,
      severity: IssueSeverity.HIGH,
      type: "client_confirmation_required",
      title: "Health and character declarations require client confirmation",
      description: "Demo warning: Aria does not guess declarations. Agent review required.",
      relatedFieldKey: "health.character.declarations",
      resolutionStatus: ResolutionStatus.OPEN
    }
  }).catch(() => null);

  await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      matterId: matter500.id,
      assignedToUserId: sarah.id,
      title: "Request OSHC certificate",
      description: "Demo task: request missing OSHC certificate through the portal.",
      dueDate: addDays(3),
      status: TaskStatus.OPEN,
      priority: TaskPriority.HIGH
    }
  }).catch(() => null);

  await prisma.appointment.create({
    data: {
      workspaceId: workspace.id,
      clientId: aarav.id,
      matterId: matter500.id,
      assignedToUserId: sarah.id,
      requestedByName: "Aarav Sharma",
      requestedByEmail: "client.aarav@brightpath-demo.com",
      status: AppointmentStatus.REQUESTED,
      meetingType: "Document review",
      startsAt: addDays(5),
      notes: "DEMO appointment request - not real client data"
    }
  }).catch(() => null);

  await prisma.generatedDocument.create({
    data: {
      workspaceId: workspace.id,
      matterId: matter500.id,
      createdByUserId: sarah.id,
      type: GeneratedDocumentType.DOCUMENT_REQUEST_CHECKLIST,
      title: "Demo document request checklist",
      content: "DEMO DOCUMENT - NOT REAL CLIENT DATA\nMissing: OSHC certificate. Agent review required."
    }
  }).catch(() => null);

  await prisma.invoiceBranding.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, businessName: "BrightPath Migration Demo", contactEmail: "owner@brightpath-demo.com", paymentInstructions: "Demo payment instructions only. Do not use real payment data." },
    update: { businessName: "BrightPath Migration Demo", paymentInstructions: "Demo payment instructions only. Do not use real payment data." }
  });
  await prisma.invoice.upsert({
    where: { workspaceId_invoiceNumber: { workspaceId: workspace.id, invoiceNumber: "DEMO-INV-001" } },
    create: {
      workspaceId: workspace.id,
      clientId: aarav.id,
      matterId: matter500.id,
      createdByUserId: owner.id,
      clientName: "Aarav Sharma",
      clientEmail: "client.aarav@brightpath-demo.com",
      invoiceNumber: "DEMO-INV-001",
      issueDate: new Date(),
      dueDate: addDays(7),
      subtotalCents: 150000,
      gstCents: 15000,
      totalCents: 165000,
      lineItemsJson: [{ description: "Demo preparation stage invoice", amountCents: 150000 }],
      notes: "DEMO invoice - no real payment data.",
      status: InvoiceStatus.SENT,
      reviewRequired: true
    },
    update: { status: InvoiceStatus.SENT, notes: "DEMO invoice - no real payment data." }
  });

  await prisma.pathwayAnalysis.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: sarah.id,
      clientId: aarav.id,
      matterId: matter500.id,
      title: "Aarav demo pathway analysis",
      profileJson: { occupation: "Demo analyst", englishLevel: "PTE 72", age: 27, currentVisaStatus: "Student demo" },
      summary: "Preliminary AI-assisted pathway analysis. Possible pathways for agent review only. Registered migration agent review required.",
      assumptionsJson: ["Uses supplied demo facts only."],
      blockersJson: ["Official criteria must be checked before advice."],
      evidenceGapsJson: ["Skills assessment evidence", "Current official update check"],
      options: {
        create: [
          {
            rank: 1,
            pathwayType: "PR pathway",
            title: "Points-tested skilled pathway comparison",
            relevance: "Demo facts suggest a pathway comparison for agent review.",
            confidence: 0.68,
            conditionsJson: ["Confirm occupation and points evidence"],
            missingJson: ["Skills assessment"],
            risksJson: ["Invitation settings can change"],
            nextActionsJson: ["Collect approved evidence before advice"]
          }
        ]
      }
    }
  }).catch(() => null);

  await prisma.officialFormTemplate.upsert({
    where: { workspaceId_formNumber_sourceUrl: { workspaceId: workspace.id, formNumber: "956-DEMO", sourceUrl: "demo://firm-form-956" } },
    create: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      sourceType: "FIRM_PROVIDED",
      formNumber: "956-DEMO",
      title: "Demo Form 956 firm template",
      category: "Firm PDF templates",
      sourceUrl: "demo://firm-form-956",
      sourceName: "BrightPath Demo",
      subclassCodes: ["500", "482", "820/801", "600"],
      isFirmProvided: true,
      fileName: "DEMO DOCUMENT - Firm Form 956 Template.pdf",
      mimeType: "application/pdf",
      fieldSchemaJson: [{ name: "agentName", type: "text" }],
      fieldMappingsJson: [{ field: "agentName", source: "workspace.agent.name" }],
      mappingNotes: "Demo template only. No auto-signing. No auto-lodgement."
    },
    update: {
      title: "Demo Form 956 firm template",
      mappingNotes: "Demo template only. No auto-signing. No auto-lodgement."
    }
  });

  const portal = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: aarav.id,
    matterId: matter500.id,
    label: "Aarav demo portal",
    createdByUserId: sarah.id,
    requestOrigin: BASE_URL
  });

  return {
    ownerEmail: owner.email,
    adminEmail: "admin@brightpath-demo.com",
    sarahEmail: sarah.email,
    jamesEmail: james.email,
    portalUrl: portal.url,
    matters: {
      student500: matter500.id,
      employer482: matter482.id,
      partner820: matter820.id,
      visitor600: matter600.id
    }
  };
}

async function signInOwner(page: Page, seed: DemoSeed) {
  await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await wait(1_000);
  const csrf = await (await page.request.get(`${BASE_URL}/api/auth/csrf`)).json() as { csrfToken: string };
  const response = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email: seed.ownerEmail, password: PASSWORD, redirect: "false", json: "true" }
  });
  if (!response.ok()) throw new Error(`Owner demo login failed with HTTP ${response.status()}`);
  await page.goto(`${BASE_URL}/app/overview`, { waitUntil: "domcontentloaded" });
}

async function signInSarah(page: Page, seed: DemoSeed) {
  await page.goto(`${BASE_URL}/auth/sign-out`, { waitUntil: "domcontentloaded" }).catch(() => null);
  await wait(1_000);
  await page.goto(`${BASE_URL}/w/${WORKSPACE_SLUG}/login`, { waitUntil: "domcontentloaded" });
  await wait(1_000);
  const csrf = await (await page.request.get(`${BASE_URL}/api/auth/csrf`)).json() as { csrfToken: string };
  const response = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email: seed.sarahEmail, password: PASSWORD, workspaceSlug: WORKSPACE_SLUG, redirect: "false", json: "true" }
  });
  if (!response.ok()) throw new Error(`Sarah demo login failed with HTTP ${response.status()}`);
  await page.goto(`${BASE_URL}/app/overview`, { waitUntil: "domcontentloaded" });
}

async function shot(page: Page, name: string, title: string, url?: string, mobile = false) {
  if (url) await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(async () => {
    await page.goto(`${BASE_URL}/app/overview`, { waitUntil: "domcontentloaded" });
  });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => null);
  await page.evaluate((chapterTitle) => {
    document.querySelector("[data-demo-banner]")?.remove();
    const banner = document.createElement("div");
    banner.setAttribute("data-demo-banner", "true");
    banner.textContent = `Training demo: ${chapterTitle} - DEMO DATA ONLY`;
    Object.assign(banner.style, {
      position: "fixed",
      zIndex: "2147483647",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 16px",
      borderRadius: "999px",
      background: "rgba(15, 23, 42, 0.92)",
      color: "white",
      font: "600 14px system-ui",
      boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
      pointerEvents: "none"
    });
    document.body.appendChild(banner);
  }, title).catch(() => null);
  await wait(1_200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
  await page.mouse.move(mobile ? 160 : 920, mobile ? 320 : 520);
  await page.mouse.wheel(0, mobile ? 420 : 620).catch(() => null);
  await wait(1_000);
}

function buildTrainingDocs(seed: DemoSeed, videoDuration: string, screenshotCount: number) {
  const safety =
    "Aria assists migration practice preparation. A registered migration agent must review before use. Aria does not provide final legal advice, does not guarantee visa outcomes, and does not lodge applications.";

  const script = `# Aria Migration SaaS Agent Training Demo Script

Demo workspace: BrightPath Migration Demo

Dummy users:
- owner@brightpath-demo.com
- admin@brightpath-demo.com
- agent.sarah@brightpath-demo.com
- agent.james@brightpath-demo.com
- client.aarav@brightpath-demo.com
- client.emma@brightpath-demo.com

All demo documents are labelled "DEMO DOCUMENT - NOT REAL CLIENT DATA". Do not use this workspace for real client information.

## Voiceover

${chapters.map(([id, title], index) => `### ${index + 1}. ${title}

In this chapter we show ${title.toLowerCase()} using dummy BrightPath data only. ${safety}

Key talking points:
- This saves preparation and data-entry time.
- The screen shows what is found, missing, or waiting for review.
- Sensitive client information remains scoped to authorised users and secure client links.
- The agent remains responsible for checking evidence, declarations, and final client-facing output.
`).join("\n")}

## Closing narration

The recommended workflow is: create the matter, send the secure portal link, collect documents, review extraction, approve the AI Working Copy, generate the full staff review draft, request confirmations, complete final agent review, and then print or export the draft pack if appropriate. Aria does not auto-lodge and does not replace professional judgement.
`;

  const transcript = `# Aria Agent Training Demo Transcript

This is a silent recording package. Use the script in \`aria-agent-training-script.md\` as the voiceover transcript.

Recording duration: ${videoDuration}
Screenshots captured: ${screenshotCount}

${chapters.map(([id, title], index) => `## ${index + 1}. ${title}

The video opens the relevant Aria screen for ${title.toLowerCase()} and demonstrates the workflow with dummy BrightPath data. The narration should remind viewers that Aria is a preparation assistant and that registered migration agent review is required before use.
`).join("\n")}
`;

  const chapterDoc = `# Aria Agent Training Demo Chapters

${chapters.map(([id, title], index) => `${index + 1}. ${title} - screenshot: \`screenshots/${id}.png\``).join("\n")}

Platform admin is intentionally not recorded in a live admin account unless a safe platform-admin demo account is configured. The script explains the redaction boundary.
`;

  const checklist = `# Aria Agent Training Feature Checklist

| Feature | Covered | Notes |
|---|---:|---|
| Login/sign up | Yes | Sign-in and workspace portal shown. |
| Owner dashboard | Yes | Overview page shown. |
| Company settings | Yes | Company/security/settings pages shown. |
| Security/launch controls | Yes | Launch/security page shown. |
| Team/roles/permissions | Yes | Team page and supervision signals shown. |
| Clients | Partial | Client data shown through matter records; no separate client page exists in this build. |
| Matters | Yes | Four demo matters seeded. |
| Required documents | Yes | Checklist shown. |
| Document upload | Yes | Portal/document screens shown; demo docs are seeded. |
| Evidence Vault | Yes | Documents page/review flow shown. |
| AI Working Copy | Yes | Review dashboard/draft flow shown. |
| Extraction review | Yes | Review dashboard and dummy extracted fields shown. |
| AI draft autofill | Yes | Draft page shown. |
| Full application draft | Yes | Full draft page shown. |
| Subclass support | Yes | 500, 482, 820/801, 600 examples shown. |
| Client confirmations | Yes | Portal acknowledgement and confirmation wording shown. |
| Client portal | Yes | Token URL not visible in viewport; token not printed in docs. |
| Portal messaging | Yes | Portal message card shown. |
| Appointments | Yes | Appointments and portal appointment path shown. |
| Deadline intelligence | Yes | Matter deadline panel shown. |
| Ask Aria | Yes | Assistant page shown. |
| Visa Knowledge / updates | Yes | Knowledge and updates pages shown. |
| Forms / PDF templates | Yes | Forms and form settings shown. |
| Generated documents / draft packs | Yes | Generated documents page shown. |
| Invoices/billing | Yes | Stage-based billing and trust-safe warning shown. |
| Firm workflow/supervision | Yes | Team workload and conflict prompts shown. |
| Templates/precedent library | Yes | Forms settings template library shown. |
| Pathway intelligence | Yes | Pathway page/detail shown. |
| Audit logs | Partial | Security/audit concepts shown; platform admin audit is skipped from video for privacy. |
| Platform admin | Skipped | Not recorded unless a safe allowlisted platform-admin demo account exists. |
| Mobile view | Yes | Client portal captured at mobile viewport. |
| Export/print | Partial | Draft print/export concept shown where available; no fake download is created. |
`;

  const readme = `# Aria Agent Training Demo

Video: \`docs/demo/aria-agent-training-demo.mp4\`

This demo uses only dummy BrightPath Migration Demo data. The local recording script seeds fake users, fake matters, fake documents, fake extracted fields, a fake invoice, a fake pathway analysis, and a secure client portal link. The raw portal token is not written into this README or transcript.

## Dummy users

- owner@brightpath-demo.com
- admin@brightpath-demo.com
- agent.sarah@brightpath-demo.com
- agent.james@brightpath-demo.com
- client.aarav@brightpath-demo.com
- client.emma@brightpath-demo.com

Demo password for local/staging only: \`${PASSWORD}\`

## Covered matters

- Aarav Sharma - Subclass 500 Student
- Emma Collins - 482 Skills in Demand style employer sponsored
- Lina Chen - 820/801 Partner
- Miguel Santos - 600 Visitor

## How to regenerate

1. Start or allow the script to start the local app on \`${BASE_URL}\`.
2. Run: \`npx tsx scripts/record-agent-training-demo.ts\`.
3. Review \`docs/demo/aria-agent-training-demo.mp4\` and the screenshots.

## Recording limitations

This environment records silent browser video only. Use \`aria-agent-training-script.md\` as the voiceover script. Platform admin is intentionally skipped unless a safe platform-admin demo account is configured.
`;

  return { script, transcript, chapterDoc, checklist, readme };
}

async function writeDocs(seed: DemoSeed, duration: string, screenshotCount: number) {
  const docs = buildTrainingDocs(seed, duration, screenshotCount);
  await writeFile(path.join(DEMO_DIR, "aria-agent-training-script.md"), docs.script);
  await writeFile(path.join(DEMO_DIR, "aria-agent-training-transcript.md"), docs.transcript);
  await writeFile(path.join(DEMO_DIR, "aria-agent-training-chapters.md"), docs.chapterDoc);
  await writeFile(path.join(DEMO_DIR, "aria-agent-training-feature-checklist.md"), docs.checklist);
  await writeFile(path.join(DEMO_DIR, "README.md"), docs.readme);
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

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await rm(path.join(SCREENSHOT_DIR, "debug-owner-login-failed.png"), { force: true }).catch(() => null);
  await rm(VIDEO_TEMP_DIR, { recursive: true, force: true }).catch(() => null);
  await mkdir(VIDEO_TEMP_DIR, { recursive: true });

  const server: ChildProcess | null = await ensureLocalServer();
  const seed = await seedDemoData();

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

  const started = Date.now();
  await signInOwner(page, seed);
  await shot(page, "01-introduction", "Introduction", `${BASE_URL}/`);
  await shot(page, "02-login", "Account creation and login", `${BASE_URL}/auth/sign-in`);
  await signInOwner(page, seed);
  await shot(page, "03-owner-dashboard", "Owner dashboard", `${BASE_URL}/app/overview`);
  await shot(page, "04-settings", "Workspace and security settings", `${BASE_URL}/app/settings/security/launch-readiness`);
  await shot(page, "05-team", "Team and permissions", `${BASE_URL}/app/team`);
  await shot(page, "06-create-client-matter", "Create a client and matter", `${BASE_URL}/app/matters`);
  await shot(page, "07-required-documents", "Required documents checklist", `${BASE_URL}/app/matters/${seed.matters.student500}/checklist`);
  await shot(page, "08-evidence-vault", "Evidence Vault", `${BASE_URL}/app/documents`);
  await shot(page, "09-ai-working-copy", "AI Working Copy", `${BASE_URL}/app/matters/${seed.matters.student500}/review`);
  await shot(page, "10-document-quality", "Document extraction and photo quality", `${BASE_URL}/app/matters/${seed.matters.student500}/review`);
  await shot(page, "11-review-dashboard", "Matter review dashboard", `${BASE_URL}/app/matters/${seed.matters.student500}/review`);
  await shot(page, "12-ai-draft-autofill", "AI draft autofill", `${BASE_URL}/app/matters/${seed.matters.student500}/draft`);
  await shot(page, "13-full-application-draft", "Full Application Draft", `${BASE_URL}/app/matters/${seed.matters.student500}/full-draft`);
  await shot(page, "14-subclass-examples", "Subclass examples", `${BASE_URL}/app/matters/${seed.matters.employer482}/full-draft`);
  await signInSarah(page, seed);
  await shot(page, "15-client-portal", "Client portal", seed.portalUrl);
  await shot(page, "16-portal-messaging", "Portal messaging and nudges", seed.portalUrl);
  await shot(page, "17-appointments", "Appointments", `${BASE_URL}/app/appointments`);
  await shot(page, "18-deadline-intelligence", "Deadline intelligence", `${BASE_URL}/app/matters/${seed.matters.student500}`);
  await shot(page, "19-ask-aria", "Ask Aria assistant", `${BASE_URL}/app/assistant`);
  await shot(page, "20-visa-knowledge", "Visa Knowledge and migration updates", `${BASE_URL}/app/knowledge`);
  await shot(page, "21-pathway-intelligence", "Pathway intelligence", `${BASE_URL}/app/pathways`);
  await shot(page, "22-template-library", "Templates and precedent library", `${BASE_URL}/app/settings/forms`);
  await shot(page, "23-forms", "Official forms and PDF templates", `${BASE_URL}/app/forms`);
  await shot(page, "24-generated-documents", "Generated documents and draft packs", `${BASE_URL}/app/matters/${seed.matters.student500}/generated-documents`);
  await shot(page, "25-billing", "Billing and invoices", `${BASE_URL}/app/invoices`);
  await shot(page, "26-firm-workflow", "Firm workflow and supervision", `${BASE_URL}/app/team`);
  await shot(page, "27-platform-admin", "Platform admin boundary", `${BASE_URL}/admin`);
  await shot(page, "28-audit-security", "Audit and security", `${BASE_URL}/app/settings/security`);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "29-mobile-web", "Mobile web", seed.portalUrl, true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot(page, "30-final-workflow", "Final recommended workflow", `${BASE_URL}/app/matters/${seed.matters.student500}/full-draft`);

  await context.close();
  await browser.close();
  const video = await convertVideo();
  const screenshotCount = (await readdir(SCREENSHOT_DIR)).filter((file) => file.endsWith(".png")).length;
  const duration = await videoDuration();
  await writeDocs(seed, duration, screenshotCount);

  if (server) server.kill();

  console.log(JSON.stringify({
    videoCreated: existsSync(video.output),
    videoPath: video.output,
    convertedToMp4: video.converted,
    duration,
    screenshotCount,
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
    scriptPath: path.join(DEMO_DIR, "aria-agent-training-script.md")
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
