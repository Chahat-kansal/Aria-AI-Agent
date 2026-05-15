import { buildFullApplicationDraftFromContext, FULL_APPLICATION_DRAFT_DISCLAIMER } from "../lib/services/full-application-draft";
import { listFullApplicationDraftTemplates } from "../lib/templates/application-drafts";
import { listVisaWorkflowSupport } from "../lib/services/visa-workflow-support";
import type { FullDraftContext, FullDraftSupportLevel } from "../lib/services/full-application-draft-types";

const expected: Array<{ code: string; level: FullDraftSupportLevel }> = [
  { code: "590", level: "CHECKLIST_AND_INTAKE" },
  { code: "407", level: "CHECKLIST_AND_INTAKE" },
  { code: "408", level: "CHECKLIST_AND_INTAKE" },
  { code: "400", level: "CHECKLIST_AND_INTAKE" },
  { code: "300", level: "CHECKLIST_AND_INTAKE" },
  { code: "870", level: "CHECKLIST_AND_INTAKE" },
  { code: "103", level: "CHECKLIST_AND_INTAKE" },
  { code: "143", level: "CHECKLIST_AND_INTAKE" },
  { code: "101", level: "CHECKLIST_AND_INTAKE" },
  { code: "802", level: "CHECKLIST_AND_INTAKE" },
  { code: "188", level: "CHECKLIST_AND_INTAKE" },
  { code: "858", level: "CHECKLIST_AND_INTAKE" },
  { code: "494", level: "FULL_STAFF_DRAFT" },
  { code: "BRIDGING", level: "CHECKLIST_ONLY" },
  { code: "REVIEW", level: "CHECKLIST_AND_INTAKE" },
  { code: "MINISTERIAL", level: "CHECKLIST_AND_INTAKE" },
  { code: "PIC4020", level: "CHECKLIST_AND_INTAKE" },
  { code: "S56", level: "CHECKLIST_AND_INTAKE" },
  { code: "CHARACTER_RESPONSE", level: "CHECKLIST_AND_INTAKE" },
  { code: "HEALTH_WAIVER", level: "CHECKLIST_AND_INTAKE" },
  { code: "482_SUBSEQUENT_ENTRANT", level: "FULL_STAFF_DRAFT" },
  { code: "186_TRT", level: "FULL_STAFF_DRAFT" },
  { code: "186_DIRECT_ENTRY", level: "FULL_STAFF_DRAFT" },
  { code: "600_TOURIST", level: "FULL_STAFF_DRAFT" },
  { code: "600_SPONSORED_FAMILY", level: "FULL_STAFF_DRAFT" },
  { code: "600_BUSINESS_VISITOR", level: "FULL_STAFF_DRAFT" },
  { code: "491_FAMILY_SPONSORED", level: "FULL_STAFF_DRAFT" },
  { code: "485_SUBSEQUENT_ENTRANT", level: "FULL_STAFF_DRAFT" },
  { code: "subseq", level: "FULL_STAFF_DRAFT" },
  { code: "EOI", level: "FULL_STAFF_DRAFT" },
  { code: "ROI", level: "FULL_STAFF_DRAFT" },
  { code: "eoi", level: "FULL_STAFF_DRAFT" },
  { code: "roi", level: "FULL_STAFF_DRAFT" }
];

function assertCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function context(code: string): FullDraftContext {
  return {
    matter: {
      id: `expanded-${code}`,
      reference: `EXP-${code}`,
      title: `Dummy ${code} workflow`,
      visaSubclass: code,
      visaStream: "Dummy preparation stream",
      stage: "DRAFTING",
      status: "ACTIVE",
      readinessScore: 55
    },
    client: {
      firstName: "Dummy",
      lastName: "Applicant",
      dob: new Date("1995-01-01"),
      nationality: "Testland",
      email: "dummy@example.test",
      phone: "+61 400 000 000"
    },
    workspace: {
      name: "Aria Expanded Draft QA",
      legalName: "Aria Expanded Draft QA Pty Ltd"
    },
    agent: {
      name: "QA Agent",
      jobTitle: "Registered Migration Agent MARN 0000000",
      notes: "MARN 0000000"
    },
    documents: [
      { id: "doc-passport", fileName: "dummy-passport.pdf", category: "Identity", extractionStatus: "EXTRACTED", reviewStatus: "VERIFIED" },
      { id: "doc-form956", fileName: "dummy-form-956.pdf", category: "Forms", extractionStatus: "EXTRACTED", reviewStatus: "PENDING" }
    ],
    draftFields: [
      {
        key: "applicant.full_name",
        label: "Full name",
        value: "Dummy Applicant",
        status: "VERIFIED",
        confidence: 0.98,
        sourceDocument: "dummy-passport.pdf",
        sourcePageRef: "p.1"
      },
      {
        key: "applicant.passport_number",
        label: "Passport number",
        value: "P0000000",
        status: "SUPPORTED",
        confidence: 0.9,
        sourceDocument: "dummy-passport.pdf",
        sourcePageRef: "p.1"
      },
      {
        key: "health.declarations",
        label: "Health declarations",
        value: "No",
        status: "NEEDS_REVIEW",
        sourceDocument: "dummy-client-confirmation.pdf"
      }
    ],
    clientConfirmationItems: [{ category: "document_accuracy", label: "Document accuracy", status: "PENDING" }],
    safety: {
      readyForAgentFinalReview: false,
      hardBlockers: [{ title: "Client confirmation is still required" }],
      softBlockers: [{ title: "Agent review required" }],
      recommendedActions: ["Review missing evidence and request client confirmation."]
    }
  };
}

function forbiddenTextCheck(serialized: string, code: string) {
  for (const phrase of ["ready to lodge", "Pioneer Global", "MigrateOS", "tokenHash", "storageKey", "rawDocumentUrl", "visa guaranteed"]) {
    assertCondition(!serialized.toLowerCase().includes(phrase.toLowerCase()), `${code}: forbidden phrase leaked: ${phrase}`);
  }
}

async function main() {
  const supportRows = listVisaWorkflowSupport();
  const configuredCodes = new Set(listFullApplicationDraftTemplates().flatMap((template) => template.subclassCodes));
  for (const item of expected) {
    assertCondition(configuredCodes.has(item.code), `${item.code}: template code is not registered`);
    const support = supportRows.find((row) => row.code === item.code);
    assertCondition(support?.supportLevel === item.level, `${item.code}: support level should be ${item.level} but was ${support?.supportLevel}`);
    const draft = buildFullApplicationDraftFromContext(context(item.code));
    const serialized = JSON.stringify(draft);
    assertCondition(draft.disclaimer === FULL_APPLICATION_DRAFT_DISCLAIMER, `${item.code}: disclaimer missing`);
    assertCondition(draft.supportLevel === item.level, `${item.code}: draft support level mismatch`);
    assertCondition(draft.documentMatrix.length >= 5, `${item.code}: document matrix too thin`);
    assertCondition(draft.sections.some((section) => section.key === "primary_applicant_identity"), `${item.code}: identity section missing`);
    assertCondition(draft.sections.some((section) => section.key === "terms_application_context"), `${item.code}: terms/application context section missing`);
    assertCondition(draft.sections.some((section) => section.key === "applicant_declarations"), `${item.code}: applicant declarations section missing`);
    assertCondition(draft.sections.some((section) => section.key === "police_clearance_certificate"), `${item.code}: PCC detected section missing`);
    if (item.code === "485_SUBSEQUENT_ENTRANT" || item.code === "subseq") {
      assertCondition(draft.sections.some((section) => section.key === "subsequent_entrant_context"), `${item.code}: 485 subsequent entrant section missing`);
    }
    assertCondition(serialized.includes("[MISSING]") || serialized.includes("NOT_FOUND_IN_APPROVED_EVIDENCE"), `${item.code}: missing markers absent`);
    assertCondition(serialized.includes("AGENT_REVIEW_REQUIRED"), `${item.code}: agent review marker absent`);
    assertCondition(serialized.includes("CLIENT_CONFIRMATION_REQUIRED"), `${item.code}: client confirmation marker absent`);
    assertCondition(serialized.includes("UNSAFE_TO_AUTOFILL"), `${item.code}: unsafe marker absent`);
    forbiddenTextCheck(serialized, item.code);
    console.log(`PASS ${item.code}: ${item.level}, ${draft.sections.length} sections, ${draft.documentMatrix.length} document requirements`);
  }
  console.log("Expanded subclass draft readiness PASS");
}

main().catch((error) => {
  console.error("Expanded subclass draft readiness FAIL");
  console.error(error);
  process.exit(1);
});
