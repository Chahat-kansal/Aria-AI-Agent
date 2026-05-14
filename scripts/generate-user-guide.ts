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
  "Screenshot note: screenshots were captured from localhost with dummy guide data only. The guide does not include real client data, secrets, raw tokens, token hashes, or raw document URLs.";

const sections: GuideSection[] = [
  {
    title: "Introduction",
    screenshots: ["landing.png"],
    body: [
      "Aria Migration is a migration-practice SaaS for workspace owners, company admins, migration agents, staff, clients, and privacy-safe platform operators.",
      "Aria helps organise clients, matters, documents, evidence extraction, application draft fields, subclass readiness, client confirmations, appointments, generated draft packs, firm PDF templates, updates, audit logs, launch controls, and AI-assisted practice support.",
      "Think of Aria as an evidence-backed preparation workspace. It helps a migration practice assemble the file, surface missing evidence, prepare draft field values, request client confirmations, and create draft packs for review.",
      "Aria is not intended to be the final decision-maker. The registered migration agent remains responsible for checking evidence, assessing legal strategy, confirming declarations, approving documents, and deciding what is suitable to use.",
      "Aria does not replace a registered migration agent, does not provide final legal advice, does not guarantee visa outcomes, and does not lodge applications automatically.",
      reviewNotice
    ]
  },
  {
    title: "Account Creation And Sign In",
    screenshots: ["sign-in.png", "sign-up.png", "staff-login.png"],
    body: [
      "Workspace owners use the public sign-up/sign-in flow when public signup is enabled by the operator. Staff and agents normally enter through the workspace staff portal or an invite link.",
      "Public signup may be disabled in production until launch controls are approved. That is expected and should be treated as an operational safety setting, not a broken page.",
      "The first owner account controls the workspace setup. Staff and agent users should be invited into the workspace rather than creating separate unrelated company accounts.",
      "If an agent sees a message telling them to use the workspace portal, that means their account is staff-scoped and should sign in through /w/[workspaceSlug]/login."
    ],
    steps: [
      "Open /auth/sign-up to create an owner workspace when public signup is enabled.",
      "Open /auth/sign-in to sign in as a workspace owner.",
      "Open /w/[workspaceSlug]/login for staff and agent login.",
      "Use invite links to activate staff accounts and set a password.",
      "If login fails, check whether the account is an owner account, an invited staff account, a deactivated user, or a user whose invite/password setup is incomplete."
    ]
  },
  {
    title: "Owner Dashboard",
    screenshots: ["app-overview.png"],
    body: [
      "The owner dashboard lives at /app/overview. It gives the owner a workspace-wide overview of caseload, recent work, AI and evidence status, and fast actions.",
      "Owners can see workspace-wide data according to their role. Agents and staff remain scoped by role and assignment.",
      "The daily briefing highlights priority actions, blocked matters, follow-up queues, review-required evidence, and the standing review warning.",
      "Use the dashboard as a triage screen. It is designed to answer: what needs review, what is blocked, which matters need evidence, and which workflows need agent attention.",
      "The dashboard should not be treated as legal readiness. A matter can look operationally complete and still require agent analysis, client confirmation, or legal review."
    ],
    steps: [
      "Sign in as the workspace owner.",
      "Open Overview from the sidebar.",
      "Scan the daily briefing for priority actions and warnings.",
      "Use cards and quick actions to move into matters, documents, drafts, updates, and settings.",
      "Open any blocked or review-required matter before sending client-facing documents or confirmations."
    ]
  },
  {
    title: "Company And Workspace Settings",
    screenshots: ["settings.png", "security-settings.png", "launch-readiness.png"],
    body: [
      "Workspace settings include company profile, AI settings, document settings, forms settings, appointment settings, client portal settings, security, and data controls where configured.",
      "Settings pages are owner/admin controlled and should persist only through existing app forms and APIs.",
      "Launch readiness records security, privacy, subclass support, operations, and product checks without saying Aria is legally compliant or fully secure.",
      "Use settings to control how the workspace operates: whether AI draft autofill is enabled, which document types are accepted, how the client portal behaves, how appointments are requested, and how data export/archive controls appear.",
      "Security and launch pages are operational checklists. They are there to help the owner spot configuration gaps before using real client workflows."
    ],
    steps: [
      "Open /app/company for company profile details.",
      "Open /app/settings for the settings index.",
      "Use /app/settings/security for security status and /app/settings/security/launch-readiness for launch readiness.",
      "Review AI, cron, encryption, email, client portal, document, forms, appointment, and export settings before inviting clients.",
      "Keep unsupported workflows disabled or clearly labelled rather than relying on staff memory."
    ]
  },
  {
    title: "Team And Agent Management",
    screenshots: ["team.png"],
    body: [
      "The team page lets authorised owners/admins invite staff, manage roles, and maintain assigned-only agent access.",
      "Agent isolation is central to Aria: one assigned agent should not see another agent's private client, matter, document, draft, export, or assistant context.",
      "Use roles deliberately. A company owner should be rare, admins should be trusted operational users, agents should generally work within assigned matter scope, and support/staff users should receive only the permissions they need.",
      "When adding a new staff member, confirm the invite email, role, visibility scope, and whether they need firm-wide access or assigned-only access."
    ],
    steps: [
      "Open /app/team as an authorised owner/admin.",
      "Invite staff or agents with the correct role.",
      "Assign matters to agents from the matter workflow.",
      "Use role permissions and assignment scope to separate agent data.",
      "After changing a role, test the user can access only the expected matters and settings.",
      "Deactivate users promptly when they leave the practice or no longer need access."
    ]
  },
  {
    title: "Platform Admin Console",
    screenshots: ["admin-dashboard.png", "admin-workspaces.png", "admin-security.png", "admin-subclass-support.png"],
    body: [
      "The platform admin console lives under /admin and is for the SaaS operator, not normal agency owners.",
      "Platform admin views are privacy-safe by design: they show workspace/user metadata, counts, statuses, launch controls, system health, deployment info, subclass support, billing/plan metadata, and redacted audit summaries.",
      "Platform admin pages must not show uploaded document contents, extracted text, draft field values, passport numbers, DOBs, visa grant numbers, raw document URLs, raw tokens, token hashes, or secrets.",
      "Use the platform admin console for operational support: checking whether a workspace is active, whether feature flags are enabled, whether runtime services are configured, whether subclass support labels are current, and whether a deployment is healthy.",
      "If a customer needs support with private matter content, use a controlled support process. Do not use platform admin screens to read private client documents or draft answers."
    ],
    steps: [
      "Open /admin as a platform-admin allowlisted user.",
      "Use Workspaces to inspect safe metadata, plan, status, and feature flags.",
      "Use Security and System Health to review configured/not-configured status without secret values.",
      "Use Subclass Support to confirm support labels match the actual harness-tested product state.",
      "Use redacted audit views for operational diagnosis without exposing private client content."
    ]
  },
  {
    title: "Clients",
    screenshots: ["matter-detail.png"],
    body: [
      "Client records connect people to matters, documents, client portal links, intake requests, confirmations, appointments, and generated documents.",
      "Client data remains workspace scoped and permission checked.",
      "In the current app, client context is visible inside the matter workflow and related client-facing portal flows. A separate /app/clients route was not present in this build.",
      "A client record is not just contact information. It becomes the anchor for the matter, document evidence, appointment requests, portal links, confirmation answers, and generated outputs.",
      "Be careful with names, dates of birth, passports, grant numbers, addresses, and notes. Those values are private client data and should only appear in authorised views."
    ],
    steps: [
      "Open the clients area if enabled in the current navigation.",
      "Create or view a client record.",
      "Link the client to matters and portal workflows."
    ]
  },
  {
    title: "Matters",
    screenshots: ["app-matters.png", "matter-detail.png"],
    body: [
      "Matters are the core workflow hub. A matter has a client, subclass, assignment, status, review dashboard, checklist, draft fields, forms, generated documents, and safety gate status.",
      "Matter pages include /app/matters, /app/matters/[matterId], /review, /draft, /forms, /checklist, and /generated-documents.",
      "The matter detail page is the operational hub. It shows who the matter belongs to, which subclass applies, what stage the matter is in, which tasks and documents are outstanding, and which Aria actions are available.",
      "Matter status is preparation status, not legal approval. Even if Aria shows strong readiness, the agent must review the facts, evidence, and legal position before use."
    ],
    steps: [
      "Create a matter from the matters page.",
      "Choose the visa subclass honestly.",
      "Assign the responsible agent.",
      "Upload dummy or client-authorised documents.",
      "Use the review and draft pages to prepare the file for agent final review.",
      "Use generated documents and forms only after reviewing missing evidence and safety warnings.",
      "Never use another client's matter as a shortcut or template unless the app provides an approved reusable firm template workflow."
    ]
  },
  {
    title: "Documents",
    screenshots: ["app-documents.png"],
    body: [
      "Documents can be uploaded and linked to clients/matters. Downloads should go through permission-checked app routes.",
      "Aria stores extraction status, source metadata, checksums, and secure document references without exposing raw public storage URLs.",
      "Document uploads are the start of the evidence chain. A document can support extracted fields, checklist items, draft answers, client confirmations, and safety gate checks.",
      "Use clear scans and correctly labelled document categories where possible. Poor scans, mismatched file types, or unclear documents may reduce extraction confidence and increase review work."
    ],
    steps: [
      "Open /app/documents.",
      "Upload supported file types only.",
      "Link documents to a matter/client.",
      "Review extraction status and evidence mapping from the matter review dashboard.",
      "Do not share raw file links. Use the built-in secure download and client portal flows.",
      "If a document contains sensitive identity information, confirm that only authorised users can access it."
    ]
  },
  {
    title: "Extracted Evidence Review",
    screenshots: ["matter-review.png"],
    body: [
      "The matter review dashboard shows extracted fields, confidence, source document references, snippets where authorised, missing evidence, conflicts, and safety warnings.",
      "Unsafe declaration fields stay review-required and client-confirmation-required where applicable.",
      "Use this screen to compare what Aria extracted against the actual evidence. A high confidence score is useful, but it is not a substitute for agent judgment.",
      "Conflicts matter. If two documents disagree on a name, date, passport number, grant number, address, relationship date, employment period, or points claim, resolve the conflict before relying on the draft."
    ],
    steps: [
      "Open the Review page for a matter.",
      "Check each evidence section relevant to the subclass.",
      "Review confidence, source document, page reference, and source snippet where available.",
      "Resolve missing evidence, low-confidence fields, and conflicts before moving to final review.",
      "Leave health, character, relationship, points, and declaration fields review-required unless the client and agent have confirmed them."
    ]
  },
  {
    title: "AI Draft Autofill",
    screenshots: ["matter-draft.png"],
    body: [
      "AI draft autofill maps evidence-backed extracted fields into application draft fields. It preserves verified fields and keeps unsafe or unsupported fields in review-required states.",
      "The app uses the wording Ready for agent final review, not Ready to lodge.",
      "Autofill is designed to reduce manual data entry and highlight source-backed values. It should not invent missing facts, infer legal conclusions, or finalise declarations.",
      "Every populated value should be traceable to a source, confidence level, and review status. If the source is missing or weak, the field should remain review-required."
    ],
    steps: [
      "Open a matter draft page.",
      "Run draft autofill.",
      "Review source-backed populated fields.",
      "Verify, edit, or reject each field.",
      "Rerun autofill if needed; verified fields should not be overwritten.",
      "Send client confirmation for personal details, documents, health/character declarations, relationship details, study/GTE, financial capacity, employment, insurance, visitor travel purpose, or skilled points where relevant.",
      "Use final review only after blockers and client confirmations have been resolved."
    ]
  },
  {
    title: "Application Drafts",
    screenshots: ["application-drafts.png", "matter-draft.png"],
    body: [
      "The application drafts area lists draft work across the workspace. A matter draft page shows field readiness, source-linked field evidence, verified fields, conflicts, and draft versions.",
      "Fields can be verified, edited, or rejected by an authorised user. Verified fields are protected from overwrite during later autofill runs.",
      "Drafts remain agent-review-required and use the safety wording Ready for agent final review rather than Ready to lodge.",
      "A draft version helps the practice understand what changed over time. Use versions to compare field population, reviewed fields, missing evidence, and warnings.",
      "If a draft field looks complete but has no evidence link, treat it as unsupported until a source is attached or the agent manually verifies it with notes."
    ],
    steps: [
      "Open /app/application-drafts to review draft activity.",
      "Open a matter draft page for field-level review.",
      "Review each populated value against the evidence panel and confidence status.",
      "Verify only after the agent is satisfied the value is supported.",
      "Reject or edit fields that are incorrect, unsupported, stale, or inconsistent.",
      "Do not publish or export client-facing draft material until the agent has completed review."
    ]
  },
  {
    title: "Subclass Support",
    screenshots: ["launch-readiness.png", "admin-subclass-support.png"],
    body: [
      "Current supported subclasses are 500, 485, 482, 186, 820/801, 309/100, 189, 190, 491, and 600.",
      "The launch-readiness/subclass-support pages label support honestly. A subclass should show FULL_FIELD_AUTOFILL only when field definitions, extraction mappings, draft autofill, client confirmations, safety gate, review sections, PDF/template mapping, and dummy end-to-end checks exist.",
      "Unsupported or online-only workflows must be labelled honestly.",
      "Support level does not mean Aria lodges the visa. It means Aria has preparation coverage for the relevant workflow components inside the SaaS.",
      "For skilled subclasses, pay particular attention to points claims, skills assessment validity, English results, employment dates, nomination documents, and evidence-backed assumptions. For partner subclasses, pay particular attention to relationship evidence categories, timelines, witness statements, sponsor status, and declarations."
    ],
    steps: [
      "Open launch readiness or admin subclass support.",
      "Confirm the support level for the subclass before creating client expectations.",
      "Check whether official forms are fillable, manual, online-only, unsupported, or needs review.",
      "If a subclass is partial or disabled, use checklist/review support only and do not claim end-to-end field autofill."
    ]
  },
  {
    title: "Client Confirmations And Portal",
    screenshots: ["client-portal.png", "client-booking.png"],
    body: [
      "Client confirmations are matter-scoped requests for personal details, document accuracy, health/character declarations, family/relationship information, study/GTE, finances, employment, insurance, visitor travel purpose/home ties, skilled points, and sponsor/nomination details where relevant.",
      "The client portal uses secure scoped links. Clients should only see their matter/client-facing actions, not internal notes, staff data, audit logs, AI reasoning, settings, or other client matters.",
      "Client confirmation is not legal approval. It is the client's confirmation of facts, documents, and declarations for the agent to review.",
      "Portal links should be treated like sensitive access links. Revoke old links when no longer needed and generate fresh links when a client reports access issues."
    ],
    steps: [
      "Generate a portal/confirmation link from the matter workflow.",
      "Send the secure link using the configured email flow or manual copy fallback.",
      "Client uploads documents or submits confirmations.",
      "Agent reviews the returned answers before using them.",
      "If a client changes a declaration or personal detail, rerun review/safety checks before relying on the draft.",
      "Confirm portal screens never show another client's matter, internal notes, staff-only data, audit logs, token hashes, or raw document URLs."
    ]
  },
  {
    title: "Appointments",
    screenshots: ["appointments.png", "client-booking.png"],
    body: [
      "Appointments support settings, request/booking flows, and client-facing booking pages where configured.",
      "If availability or email is not configured, Aria should show an honest fallback rather than pretending a booking was confirmed.",
      "Use appointments for consultation requests, evidence review sessions, follow-up calls, and final review meetings. Appointment status should be confirmed by staff where the workflow requires manual confirmation.",
      "Client booking pages should be simple and scoped: the client should not see internal calendars, staff settings, audit logs, or unrelated matters."
    ],
    steps: [
      "Open appointment settings to configure timezone, types, availability, meeting methods, and request fallback where available.",
      "Generate or share the client booking route when appropriate.",
      "Review incoming appointment requests before confirming.",
      "Cancel or reschedule using the app workflow rather than editing records outside the system."
    ]
  },
  {
    title: "Official Forms And Company PDF Templates",
    screenshots: ["app-forms.png", "matter-forms.png"],
    body: [
      "Aria tracks official forms and firm PDF templates with labels such as fillable, manual, online-only, unsupported, or needs review.",
      "Companies can upload firm templates, detect PDF fields, map canonical Aria field keys, and generate draft PDFs where supported.",
      "Aria must not auto-sign, auto-lodge, or claim a form was submitted.",
      "Use official form labels carefully. Some Home Affairs workflows are online-only or require manual completion in external systems. Aria should support preparation and draft review without pretending to submit anything.",
      "Firm templates are useful for practice-specific cover letters, questionnaires, checklists, and internal PDFs. Field mapping should use canonical keys so the same evidence-backed values can fill supported templates consistently."
    ],
    steps: [
      "Open /app/forms for the form library and support labels.",
      "Open a matter forms page to see relevant forms and draft options for that matter.",
      "Upload a firm PDF template only if it is safe, dummy/tested, and intended for mapping.",
      "Map detected PDF fields to Aria canonical keys.",
      "Generate a draft PDF, review blank/needs-review fields, and never auto-sign."
    ]
  },
  {
    title: "Generated Documents And Draft Packs",
    screenshots: ["generated-documents.png"],
    body: [
      "Generated documents and draft packs may include checklists, draft PDFs, summaries, covering letters, and missing-evidence warnings depending on the matter and configured templates.",
      "Every generated output remains agent-review-required and permission checked.",
      "Generated outputs should make review easier, not replace it. Check that every section belongs to the current matter, contains no other client's data, and clearly marks missing or uncertain material.",
      "If a generated document includes client-facing text, ensure it includes the correct company details, agent details, terms/conditions where configured, and the appropriate review wording."
    ],
    steps: [
      "Open the generated documents page for the matter.",
      "Generate the draft pack or mapped PDF only after evidence review has run.",
      "Check warnings, unsupported fields, blank fields, and missing evidence before sharing.",
      "Download or publish only through permission-checked app routes."
    ]
  },
  {
    title: "Invoices",
    screenshots: ["invoices.png", "invoice-new.png"],
    body: [
      "If enabled, invoices include setup, manual invoice creation, generated invoice drafts, logo/signature settings where present, and invoice detail pages.",
      "Invoices should document billing metadata only and avoid exposing unrelated client private data.",
      "The invoice area is separate from legal preparation. Treat it as operational billing support and confirm amounts, taxes, services, recipients, and payment instructions before sending.",
      "If AI invoice generation is available, review every line item before use. The app should not invent fees, claim work was completed, or expose private matter content unnecessarily."
    ],
    steps: [
      "Open /app/invoices to see invoices and billing workflow.",
      "Configure invoice branding/assets if the setup page is enabled.",
      "Create a manual invoice or use a generated draft if available.",
      "Review recipient, services, totals, due dates, and notes before download or sending."
    ]
  },
  {
    title: "Ask Aria Assistant",
    screenshots: ["assistant.png"],
    body: [
      "Ask Aria is an AI-assisted workspace/matter assistant with source/evidence panels, confidence, missing information, warnings, and recommended next actions.",
      "Aria should answer within the user's permission scope only. It should not reveal hidden matters, guarantee outcomes, provide final legal advice, or say an application can be lodged without review.",
      "Good prompts ask for evidence summaries, missing items, risk flags, next administrative steps, or draft review checklists. Unsafe prompts ask Aria to guarantee an outcome, decide legal eligibility finally, or lodge without review.",
      "Every answer involving migration facts should include evidence used, source type, confidence, missing information, a review-required warning, and a recommended next action where the feature is configured."
    ],
    steps: [
      "Open /app/assistant.",
      "Choose workspace or matter context.",
      "Ask a specific question.",
      "Read the answer, evidence used, confidence, missing information, and review warning.",
      "Treat the response as agent-review-required.",
      "If the response references a client, matter, document, or fact outside your permitted scope, stop and report it as a privacy issue.",
      "Do not paste real secrets, passwords, API keys, or unnecessary raw document text into prompts."
    ]
  },
  {
    title: "Visa Knowledge And Migration Updates",
    screenshots: ["knowledge.png", "updates.png"],
    body: [
      "Visa Knowledge and Updates distinguish official source material, workspace notes, migration intelligence, and news/intel where configured.",
      "Search, filters, badges, source labels, and update sweeps must remain readable in both light and dark mode.",
      "Use Visa Knowledge for research support and operational awareness. Confirm official rules and policy directly with authoritative sources before relying on them in client advice.",
      "Migration updates can help surface changes that may affect a workspace, but they should not silently change client strategy or final advice."
    ],
    steps: [
      "Open /app/knowledge to search stored knowledge records.",
      "Use source labels to distinguish official material from news, intel, or workspace notes.",
      "Open /app/updates for migration updates and review workflows.",
      "Escalate relevant updates to the responsible agent for review before applying them to a matter."
    ]
  },
  {
    title: "Security, Audit, Data Export, And Incidents",
    screenshots: ["security-settings.png", "launch-readiness.png", "admin-security.png"],
    body: [
      "Security pages show runtime booleans and status, not secrets. Launch readiness tracks encryption, AI, cron, permissions, portal scoping, audit logging, legal/privacy review, support levels, and operational controls.",
      "Audit logs should record important actions while redacting raw tokens, tokenHash, raw document URLs, passport numbers, DOB plaintext, extracted text, draft answers, and source snippets.",
      "Data export and secure client folder exports require permission and should contain only the intended matter/client material.",
      "Use the security pages before using production client data. Encryption, cron, AI, email, storage, permissions, portal scoping, audit logging, launch controls, and incident workflows should be checked.",
      "Incident register workflows, if present, should record suspected issues, severity, containment, follow-up, and export/report needs without exposing unnecessary private content."
    ],
    steps: [
      "Open /app/settings/security and review configured/not-configured runtime status.",
      "Open launch readiness and review every security, legal/privacy, product, and operations item.",
      "Use audit logs to confirm key events are recorded and sensitive metadata is redacted.",
      "Use data export/archive/delete controls carefully and follow retention obligations before removing records."
    ]
  },
  {
    title: "Light And Dark Mode",
    screenshots: ["app-overview.png", "app-overview-dark.png"],
    body: [
      "The sidebar theme toggle persists the selected theme locally. Light mode uses pale lavender/off-white backgrounds with dark readable text; dark mode uses near-black purple surfaces with light readable text.",
      "Inputs, selects, textareas, dropdowns, tables, assistant panels, Visa Knowledge, client portal, auth pages, and admin pages should remain readable in both themes.",
      "If a page shows dark text on a dark surface, light text on a white field, invisible placeholders, or unreadable disabled states, treat it as a visual bug.",
      "Theme changes should not change permissions, data visibility, workflow status, or form submission behaviour."
    ],
    steps: [
      "Use the Light/Dark segmented toggle in the sidebar.",
      "Check inputs, buttons, badges, tables, warnings, dropdowns, and empty states after switching.",
      "If a screen looks wrong, refresh once to confirm the persisted theme state, then report the specific route and component."
    ]
  },
  {
    title: "Common Workflow",
    body: [
      "A normal controlled workflow is: owner creates workspace, owner invites agent, agent creates matter, agent uploads documents, Aria extracts evidence, agent reviews evidence, agent runs draft autofill, agent verifies fields, agent requests client confirmation, client responds in the portal, agent runs final cross-check, agent generates draft PDF/pack, and owner exports a secure client folder if needed.",
      "Use this workflow as a disciplined operating rhythm. It keeps evidence review before draft use, client confirmation before declaration reliance, and agent final review before anything leaves the practice.",
      "The workflow is intentionally conservative. It helps avoid common mistakes: relying on unsupported fields, losing sight of missing evidence, exposing the wrong client data, or sending client-facing material before agent review.",
      reviewNotice
    ],
    steps: [
      "Owner creates or configures the workspace and confirms launch controls.",
      "Owner/admin invites the responsible agent and confirms permissions.",
      "Agent creates the matter, chooses the subclass, and assigns responsibility.",
      "Agent or client uploads evidence through secure document workflows.",
      "Aria extracts evidence and the agent reviews fields, confidence, snippets, missing items, and conflicts.",
      "Agent runs draft autofill and verifies, edits, or rejects each field.",
      "Agent sends client confirmations for facts and declarations that need client action.",
      "Client responds through the scoped portal link.",
      "Agent reruns checks, resolves blockers, and prepares generated documents or mapped PDFs.",
      "Agent completes final review before any use outside Aria."
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
