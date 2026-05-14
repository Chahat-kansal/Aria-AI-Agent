import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type GuideSection = {
  title: string;
  body: string[];
  steps?: string[];
  screenshots?: string[];
};

const root = process.cwd();
const docsDir = path.join(root, "docs");
const screenshotsDir = path.join(docsDir, "screenshots");
const publicDocsDir = path.join(root, "public", "docs");

const reviewNotice =
  "AI-assisted output. Registered migration agent review required before use. Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.";

const screenshotNote =
  "Screenshot note: screenshot capture was attempted against the local app with dummy data only. Authenticated workspace screenshots require a reachable dummy database/session. If a screenshot is absent, the guide names the closest route and describes the real current feature without inventing data.";

const sections: GuideSection[] = [
  {
    title: "Introduction",
    screenshots: ["landing.png"],
    body: [
      "Aria Migration is a migration-practice SaaS for workspace owners, company admins, migration agents, staff, clients, and privacy-safe platform operators.",
      "Aria helps organise clients, matters, documents, evidence extraction, application draft fields, subclass readiness, client confirmations, appointments, generated draft packs, firm PDF templates, updates, audit logs, launch controls, and AI-assisted practice support.",
      "Aria does not replace a registered migration agent, does not provide final legal advice, does not guarantee visa outcomes, and does not lodge applications automatically.",
      reviewNotice
    ]
  },
  {
    title: "Account Creation And Sign In",
    screenshots: ["sign-in.png", "sign-up.png", "staff-login.png"],
    body: [
      "Workspace owners use the public sign-up/sign-in flow when public signup is enabled by the operator. Staff and agents normally enter through the workspace staff portal or an invite link.",
      "Public signup may be disabled in production until launch controls are approved. That is expected and should be treated as an operational safety setting, not a broken page."
    ],
    steps: [
      "Open /auth/sign-up to create an owner workspace when public signup is enabled.",
      "Open /auth/sign-in to sign in as a workspace owner.",
      "Open /w/[workspaceSlug]/login for staff and agent login.",
      "Use invite links to activate staff accounts and set a password."
    ]
  },
  {
    title: "Owner Dashboard",
    body: [
      "The owner dashboard lives at /app/overview. It gives the owner a workspace-wide overview of caseload, recent work, AI and evidence status, and fast actions.",
      "Owners can see workspace-wide data according to their role. Agents and staff remain scoped by role and assignment.",
      "Screenshot status: not included in this PDF because the local capture run did not have an authenticated dummy workspace session. Do not use the sign-in redirect as a fake dashboard screenshot."
    ],
    steps: [
      "Sign in as the workspace owner.",
      "Open Overview from the sidebar.",
      "Use cards and quick actions to move into matters, documents, drafts, updates, and settings."
    ]
  },
  {
    title: "Company And Workspace Settings",
    body: [
      "Workspace settings include company profile, AI settings, document settings, forms settings, appointment settings, client portal settings, security, and data controls where configured.",
      "Settings pages are owner/admin controlled and should persist only through existing app forms and APIs.",
      "Screenshot status: authenticated settings screenshots require a dummy owner session and were not substituted with repeated auth-required screens."
    ],
    steps: [
      "Open /app/company for company profile details.",
      "Open /app/settings for the settings index.",
      "Use /app/settings/security for security status and /app/settings/security/launch-readiness for launch readiness."
    ]
  },
  {
    title: "Team And Agent Management",
    body: [
      "The team page lets authorised owners/admins invite staff, manage roles, and maintain assigned-only agent access.",
      "Agent isolation is central to Aria: one assigned agent should not see another agent's private client, matter, document, draft, export, or assistant context."
    ],
    steps: [
      "Open /app/team as an authorised owner/admin.",
      "Invite staff or agents with the correct role.",
      "Assign matters to agents from the matter workflow.",
      "Use role permissions and assignment scope to separate agent data."
    ]
  },
  {
    title: "Platform Admin Console",
    screenshots: ["admin-auth-required.png"],
    body: [
      "The platform admin console lives under /admin and is for the SaaS operator, not normal agency owners.",
      "Platform admin views are privacy-safe by design: they show workspace/user metadata, counts, statuses, launch controls, system health, deployment info, subclass support, billing/plan metadata, and redacted audit summaries.",
      "Platform admin pages must not show uploaded document contents, extracted text, draft field values, passport numbers, DOBs, visa grant numbers, raw document URLs, raw tokens, token hashes, or secrets."
    ]
  },
  {
    title: "Clients",
    body: [
      "Client records connect people to matters, documents, client portal links, intake requests, confirmations, appointments, and generated documents.",
      "Client data remains workspace scoped and permission checked.",
      "Screenshot status: authenticated dummy client screenshots were not available in this local run."
    ],
    steps: [
      "Open the clients area if enabled in the current navigation.",
      "Create or view a client record.",
      "Link the client to matters and portal workflows."
    ]
  },
  {
    title: "Matters",
    body: [
      "Matters are the core workflow hub. A matter has a client, subclass, assignment, status, review dashboard, checklist, draft fields, forms, generated documents, and safety gate status.",
      "Matter pages include /app/matters, /app/matters/[matterId], /review, /draft, /forms, /checklist, and /generated-documents.",
      "Screenshot status: authenticated dummy matter screenshots were not available in this local run."
    ],
    steps: [
      "Create a matter from the matters page.",
      "Choose the visa subclass honestly.",
      "Assign the responsible agent.",
      "Upload dummy or client-authorised documents.",
      "Use the review and draft pages to prepare the file for agent final review."
    ]
  },
  {
    title: "Documents",
    body: [
      "Documents can be uploaded and linked to clients/matters. Downloads should go through permission-checked app routes.",
      "Aria stores extraction status, source metadata, checksums, and secure document references without exposing raw public storage URLs.",
      "Screenshot status: authenticated dummy document screenshots were not available in this local run."
    ],
    steps: [
      "Open /app/documents.",
      "Upload supported file types only.",
      "Link documents to a matter/client.",
      "Review extraction status and evidence mapping from the matter review dashboard."
    ]
  },
  {
    title: "Extracted Evidence Review",
    body: [
      "The matter review dashboard shows extracted fields, confidence, source document references, snippets where authorised, missing evidence, conflicts, and safety warnings.",
      "Unsafe declaration fields stay review-required and client-confirmation-required where applicable."
    ]
  },
  {
    title: "AI Draft Autofill",
    body: [
      "AI draft autofill maps evidence-backed extracted fields into application draft fields. It preserves verified fields and keeps unsafe or unsupported fields in review-required states.",
      "The app uses the wording Ready for agent final review, not Ready to lodge."
    ],
    steps: [
      "Open a matter draft page.",
      "Run draft autofill.",
      "Review source-backed populated fields.",
      "Verify, edit, or reject each field.",
      "Rerun autofill if needed; verified fields should not be overwritten."
    ]
  },
  {
    title: "Subclass Support",
    body: [
      "Current supported subclasses are 500, 485, 482, 186, 820/801, 309/100, 189, 190, 491, and 600.",
      "The launch-readiness/subclass-support pages label support honestly. A subclass should show FULL_FIELD_AUTOFILL only when field definitions, extraction mappings, draft autofill, client confirmations, safety gate, review sections, PDF/template mapping, and dummy end-to-end checks exist.",
      "Unsupported or online-only workflows must be labelled honestly.",
      "Screenshot status: launch-readiness is owner/admin protected. This PDF does not reuse the login redirect as a fake support screenshot."
    ]
  },
  {
    title: "Client Confirmations And Portal",
    body: [
      "Client confirmations are matter-scoped requests for personal details, document accuracy, health/character declarations, family/relationship information, study/GTE, finances, employment, insurance, visitor travel purpose/home ties, skilled points, and sponsor/nomination details where relevant.",
      "The client portal uses secure scoped links. Clients should only see their matter/client-facing actions, not internal notes, staff data, audit logs, AI reasoning, settings, or other client matters."
    ],
    steps: [
      "Generate a portal/confirmation link from the matter workflow.",
      "Send the secure link using the configured email flow or manual copy fallback.",
      "Client uploads documents or submits confirmations.",
      "Agent reviews the returned answers before using them."
    ]
  },
  {
    title: "Appointments",
    body: [
      "Appointments support settings, request/booking flows, and client-facing booking pages where configured.",
      "If availability or email is not configured, Aria should show an honest fallback rather than pretending a booking was confirmed."
    ]
  },
  {
    title: "Official Forms And Company PDF Templates",
    body: [
      "Aria tracks official forms and firm PDF templates with labels such as fillable, manual, online-only, unsupported, or needs review.",
      "Companies can upload firm templates, detect PDF fields, map canonical Aria field keys, and generate draft PDFs where supported.",
      "Aria must not auto-sign, auto-lodge, or claim a form was submitted."
    ]
  },
  {
    title: "Generated Documents And Draft Packs",
    body: [
      "Generated documents and draft packs may include checklists, draft PDFs, summaries, covering letters, and missing-evidence warnings depending on the matter and configured templates.",
      "Every generated output remains agent-review-required and permission checked."
    ]
  },
  {
    title: "Invoices",
    body: [
      "If enabled, invoices include setup, manual invoice creation, generated invoice drafts, logo/signature settings where present, and invoice detail pages.",
      "Invoices should document billing metadata only and avoid exposing unrelated client private data."
    ]
  },
  {
    title: "Ask Aria Assistant",
    body: [
      "Ask Aria is an AI-assisted workspace/matter assistant with source/evidence panels, confidence, missing information, warnings, and recommended next actions.",
      "Aria should answer within the user's permission scope only. It should not reveal hidden matters, guarantee outcomes, provide final legal advice, or say an application can be lodged without review.",
      "Screenshot status: authenticated assistant screenshots require a dummy workspace session and were not substituted with an unrelated screenshot."
    ],
    steps: [
      "Open /app/assistant.",
      "Choose workspace or matter context.",
      "Ask a specific question.",
      "Read the answer, evidence used, confidence, missing information, and review warning.",
      "Treat the response as agent-review-required."
    ]
  },
  {
    title: "Visa Knowledge And Migration Updates",
    body: [
      "Visa Knowledge and Updates distinguish official source material, workspace notes, migration intelligence, and news/intel where configured.",
      "Search, filters, badges, source labels, and update sweeps must remain readable in both light and dark mode.",
      "Screenshot status: authenticated knowledge/update screenshots were not available in this local run."
    ]
  },
  {
    title: "Security, Audit, Data Export, And Incidents",
    screenshots: ["security.png"],
    body: [
      "Security pages show runtime booleans and status, not secrets. Launch readiness tracks encryption, AI, cron, permissions, portal scoping, audit logging, legal/privacy review, support levels, and operational controls.",
      "Audit logs should record important actions while redacting raw tokens, tokenHash, raw document URLs, passport numbers, DOB plaintext, extracted text, draft answers, and source snippets.",
      "Data export and secure client folder exports require permission and should contain only the intended matter/client material."
    ]
  },
  {
    title: "Light And Dark Mode",
    body: [
      "The sidebar theme toggle persists the selected theme locally. Light mode uses pale lavender/off-white backgrounds with dark readable text; dark mode uses near-black purple surfaces with light readable text.",
      "Inputs, selects, textareas, dropdowns, tables, assistant panels, Visa Knowledge, client portal, auth pages, and admin pages should remain readable in both themes."
    ]
  },
  {
    title: "Common Workflow",
    body: [
      "A normal controlled workflow is: owner creates workspace, owner invites agent, agent creates matter, agent uploads documents, Aria extracts evidence, agent reviews evidence, agent runs draft autofill, agent verifies fields, agent requests client confirmation, client responds in the portal, agent runs final cross-check, agent generates draft PDF/pack, and owner exports a secure client folder if needed.",
      reviewNotice
    ]
  },
  {
    title: "Troubleshooting",
    body: [
      "AI not configured: assistant/draft features show an honest setup message or disabled state.",
      "Encryption missing: production upload should be blocked or clearly marked unsafe until configured.",
      "Email not configured: use manual copy-link fallback where implemented.",
      "Upload blocked: check file type, size, MIME type, and workspace launch controls.",
      "Form not fillable: use manual/online-only state and do not pretend PDF filling succeeded.",
      "Portal link expired or revoked: generate a fresh link if authorised.",
      "Staff cannot access matter: check assignment, visibility scope, and role permissions.",
      "No extracted fields found: upload clearer documents or review OCR/extraction confidence."
    ]
  },
  {
    title: "Safety And Legal Reminders",
    screenshots: ["ai-disclaimer.png", "privacy.png", "terms.png", "subprocessors.png"],
    body: [
      "Review by a qualified Australian lawyer/privacy professional before commercial use.",
      reviewNotice,
      "Do not delete records that must be retained for law, professional obligations, disputes, audits, or client engagement requirements.",
      "Do not use real client data until the organisation completes independent legal, privacy, and security review."
    ]
  }
];

function mdImage(name: string) {
  return `\n\n![${name}](screenshots/${name})\n`;
}

function buildMarkdown(existingScreenshots: Set<string>) {
  const lines: string[] = [
    "# Aria Migration SaaS User Guide",
    "",
    `Generated: ${new Date().toLocaleDateString("en-AU")}`,
    "",
    `> ${reviewNotice}`,
    "",
    `> ${screenshotNote}`,
    "",
    "## Table Of Contents",
    "",
    ...sections.map((section, index) => `${index + 1}. ${section.title}`),
    ""
  ];

  sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.title}`, "");
    section.body.forEach((paragraph) => lines.push(paragraph, ""));
    if (section.steps?.length) {
      section.steps.forEach((step, stepIndex) => lines.push(`${stepIndex + 1}. ${step}`));
      lines.push("");
    }
    if (section.screenshots?.length) {
      for (const screenshot of section.screenshots) {
        if (existingScreenshots.has(screenshot)) {
          lines.push(mdImage(screenshot), "");
          lines.push(`Caption: ${section.title} screen captured from localhost with dummy/local-safe context.`, "");
        } else {
          lines.push(`_Screenshot placeholder: ${screenshot} was not available in this run._`, "");
        }
      }
    }
  });

  return lines.join("\n");
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function buildPdf(existingScreenshots: Set<string>) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 54;
  let page = pdf.addPage(pageSize);
  let pageNumber = 1;
  let y = page.getHeight() - margin;

  function footer() {
    page.drawText(`Aria Migration SaaS User Guide  |  ${pageNumber}`, {
      x: margin,
      y: 24,
      size: 8,
      font: regular,
      color: rgb(0.42, 0.37, 0.55)
    });
  }

  function newPage() {
    footer();
    page = pdf.addPage(pageSize);
    pageNumber += 1;
    y = page.getHeight() - margin;
  }

  function drawParagraph(text: string, opts: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? regular;
    const color = opts.color ?? rgb(0.11, 0.08, 0.16);
    const maxChars = Math.floor((page.getWidth() - margin * 2) / (size * 0.52));
    for (const line of wrapText(text, maxChars)) {
      if (y < 72) newPage();
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + 4;
    }
    y -= opts.gap ?? 6;
  }

  async function drawScreenshot(fileName: string, caption: string) {
    if (!existingScreenshots.has(fileName)) return false;
    const imageBytes = await readFile(path.join(screenshotsDir, fileName));
    const image = fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".jpeg")
      ? await pdf.embedJpg(imageBytes)
      : await pdf.embedPng(imageBytes);
    const maxWidth = page.getWidth() - margin * 2;
    const maxHeight = 255;
    const widthScale = maxWidth / image.width;
    const heightScale = maxHeight / image.height;
    const scale = Math.min(widthScale, heightScale, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    if (y - height < 86) newPage();
    page.drawImage(image, {
      x: margin,
      y: y - height,
      width,
      height
    });
    y -= height + 8;
    drawParagraph(caption, { size: 8.5, font: italic, color: rgb(0.42, 0.37, 0.55), gap: 10 });
    return true;
  }

  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(0.965, 0.955, 0.99) });
  page.drawText("Aria Migration", { x: margin, y: 690, size: 34, font: bold, color: rgb(0.18, 0.1, 0.32) });
  page.drawText("User Guide", { x: margin, y: 648, size: 42, font: italic, color: rgb(0.49, 0.23, 0.93) });
  page.drawText("Production-launch candidate after independent legal/privacy/security review.", {
    x: margin,
    y: 604,
    size: 12,
    font: regular,
    color: rgb(0.34, 0.3, 0.45)
  });
  y = 552;
  drawParagraph(reviewNotice, { size: 11, font: bold, color: rgb(0.18, 0.1, 0.32) });
  drawParagraph(screenshotNote, { size: 9.5, font: regular, color: rgb(0.34, 0.3, 0.45) });
  newPage();

  drawParagraph("Table Of Contents", { size: 22, font: bold, color: rgb(0.18, 0.1, 0.32), gap: 14 });
  sections.forEach((section, index) => drawParagraph(`${index + 1}. ${section.title}`, { size: 10.5, color: rgb(0.31, 0.24, 0.44), gap: 2 }));
  newPage();

  for (const [index, section] of sections.entries()) {
    drawParagraph(`${index + 1}. ${section.title}`, { size: 18, font: bold, color: rgb(0.18, 0.1, 0.32), gap: 12 });
    section.body.forEach((paragraph) => drawParagraph(paragraph));
    if (section.steps?.length) {
      section.steps.forEach((step, stepIndex) => drawParagraph(`${stepIndex + 1}. ${step}`, { color: rgb(0.23, 0.18, 0.33), gap: 2 }));
      y -= 4;
    }
    if (section.screenshots?.length) {
      for (const screenshot of section.screenshots) {
        if (existingScreenshots.has(screenshot)) {
          await drawScreenshot(screenshot, `Screenshot: ${section.title} captured from localhost with dummy/local-safe context.`);
        } else {
          drawParagraph(`Screenshot placeholder: ${screenshot} was not available in this run.`, { size: 9.5, font: italic, color: rgb(0.6, 0.42, 0.12) });
        }
      }
    }
    if (y < 180) newPage();
  }

  footer();
  return pdf.save();
}

async function main() {
  await mkdir(docsDir, { recursive: true });
  await mkdir(publicDocsDir, { recursive: true });
  let screenshotNames = new Set<string>();
  try {
    screenshotNames = new Set(await readdir(screenshotsDir));
  } catch {
    screenshotNames = new Set();
  }

  const markdown = buildMarkdown(screenshotNames);
  const mdPath = path.join(docsDir, "ARIA_USER_GUIDE.md");
  const pdfPath = path.join(docsDir, "ARIA_USER_GUIDE.pdf");
  const publicPdfPath = path.join(publicDocsDir, "ARIA_USER_GUIDE.pdf");

  await writeFile(mdPath, markdown, "utf8");
  await writeFile(pdfPath, await buildPdf(screenshotNames));
  await copyFile(pdfPath, publicPdfPath);

  console.log(JSON.stringify({
    markdown: mdPath,
    pdf: pdfPath,
    publicPdf: publicPdfPath,
    screenshotCount: screenshotNames.size,
    sections: sections.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
