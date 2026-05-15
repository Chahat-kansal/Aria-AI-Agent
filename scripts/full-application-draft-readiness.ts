import { buildFullApplicationDraftFromContext, FULL_APPLICATION_DRAFT_DISCLAIMER } from "../lib/services/full-application-draft";
import { listFullApplicationDraftTemplates } from "../lib/templates/application-drafts";
import type { FullDraftContext } from "../lib/services/full-application-draft-types";

const subclasses = ["500", "485", "482", "186", "820/801", "309/100", "189", "190", "491", "600"];

function assertCondition(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function baseContext(subclassCode: string): FullDraftContext {
  return {
    matter: {
      id: `matter-${subclassCode}`,
      reference: `QA-${subclassCode}`,
      title: `Dummy Subclass ${subclassCode} matter`,
      visaSubclass: subclassCode,
      visaStream: "Dummy stream",
      stage: "DRAFTING",
      status: "ACTIVE",
      readinessScore: 72,
      currentVisaStatus: "Subclass 500",
      currentVisaExpiry: new Date("2027-02-01")
    },
    client: {
      firstName: "Dummy",
      lastName: "Applicant",
      dob: new Date("1998-04-12"),
      nationality: "Testland",
      email: "dummy.applicant@example.test",
      phone: "+61 400 000 000",
      currentVisaStatus: "Subclass 500",
      currentVisaExpiry: new Date("2027-02-01")
    },
    workspace: {
      name: "Aria Draft QA Workspace",
      legalName: "Aria Draft QA Pty Ltd",
      contactEmail: "qa@example.test",
      contactPhone: "+61 2 0000 0000",
      address: "Level 1, 1 Test Street, Sydney NSW 2000"
    },
    agent: {
      name: "QA Agent",
      email: "agent@example.test",
      jobTitle: "Registered Migration Agent MARN 0000000",
      notes: "MARN 0000000"
    },
    documents: [
      { id: "doc-passport", fileName: "dummy-passport.pdf", category: "Identity", extractionStatus: "EXTRACTED", reviewStatus: "VERIFIED" },
      { id: "doc-english", fileName: "dummy-english-test.pdf", category: "Education", extractionStatus: "EXTRACTED", reviewStatus: "VERIFIED" },
      { id: "doc-financial", fileName: "dummy-financial-evidence.pdf", category: "Financial", extractionStatus: "EXTRACTED", reviewStatus: "PENDING" },
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
        sourcePageRef: "p.1",
        sourceSnippet: "Name: Dummy Applicant"
      },
      {
        key: "applicant.date_of_birth",
        label: "Date of birth",
        value: "12 Apr 1998",
        status: "SUPPORTED",
        confidence: 0.9,
        sourceDocument: "dummy-passport.pdf",
        sourcePageRef: "p.1",
        sourceSnippet: "DOB: 12 Apr 1998"
      },
      {
        key: "applicant.passport_number",
        label: "Passport number",
        value: "P0000000",
        status: "HIGH_CONFIDENCE",
        confidence: 0.94,
        sourceDocument: "dummy-passport.pdf",
        sourcePageRef: "p.1",
        sourceSnippet: "Passport number: P0000000"
      },
      {
        key: "english.test_type",
        label: "English test type",
        value: "PTE Academic",
        status: "SUPPORTED",
        confidence: 0.88,
        sourceDocument: "dummy-english-test.pdf",
        sourcePageRef: "p.1",
        sourceSnippet: "PTE Academic"
      },
      {
        key: "english.overall_score",
        label: "Overall score",
        value: "64",
        status: "SUPPORTED",
        confidence: 0.88,
        sourceDocument: "dummy-english-test.pdf",
        sourcePageRef: "p.1",
        sourceSnippet: "Overall score: 64"
      },
      {
        key: "health.declarations",
        label: "Health declarations",
        value: "No",
        status: "NEEDS_REVIEW",
        confidence: 0.7,
        sourceDocument: "dummy-client-confirmation.pdf"
      },
      {
        key: "character.declarations",
        label: "Character declarations",
        value: "No",
        status: "NEEDS_REVIEW",
        confidence: 0.7,
        sourceDocument: "dummy-client-confirmation.pdf"
      }
    ],
    clientConfirmationItems: [
      { category: "health_declaration", label: "Health declaration", status: "PENDING" },
      { category: "character_declaration", label: "Character declaration", status: "PENDING" }
    ],
    safety: {
      readyForAgentFinalReview: false,
      hardBlockers: [{ title: "Client confirmation is still required" }],
      softBlockers: [{ title: "Some source-backed fields still need agent review" }],
      recommendedActions: ["Request client confirmation and verify source-linked fields."]
    }
  };
}

function scanNoForbiddenText(serialized: string, subclassCode: string) {
  const forbidden = [
    "ready to lodge",
    "Pioneer Global",
    "MigrateOS",
    "tokenHash",
    "raw token",
    "storageKey",
    "supabase.co/storage",
    "blob.vercel-storage.com"
  ];
  for (const phrase of forbidden) {
    assertCondition(!serialized.toLowerCase().includes(phrase.toLowerCase()), `${subclassCode}: forbidden phrase leaked: ${phrase}`);
  }
}

async function main() {
  const templateCodes = listFullApplicationDraftTemplates().flatMap((template) => template.subclassCodes);
  for (const subclassCode of subclasses) {
    assertCondition(templateCodes.includes(subclassCode) || (subclassCode === "190" || subclassCode === "491"), `${subclassCode}: full draft template missing`);
    const draft = buildFullApplicationDraftFromContext(baseContext(subclassCode));
    const serialized = JSON.stringify(draft);

    assertCondition(draft.disclaimer === FULL_APPLICATION_DRAFT_DISCLAIMER, `${subclassCode}: disclaimer missing`);
    assertCondition(draft.supportLevel === "FULL_STAFF_DRAFT", `${subclassCode}: core subclass is not marked FULL_STAFF_DRAFT`);
    assertCondition(draft.documentMatrix.length >= 6, `${subclassCode}: document matrix too thin`);
    assertCondition(draft.sections.some((section) => section.key === "primary_applicant_identity"), `${subclassCode}: identity section missing`);
    assertCondition(draft.sections.some((section) => section.key === "terms_application_context"), `${subclassCode}: terms/application context section missing`);
    assertCondition(draft.sections.some((section) => section.key === "health_character_declarations"), `${subclassCode}: unsafe declaration section missing`);
    assertCondition(draft.sections.some((section) => section.key === "applicant_declarations"), `${subclassCode}: applicant declarations section missing`);
    assertCondition(draft.sections.some((section) => section.key === "police_clearance_certificate"), `${subclassCode}: PCC detected section missing`);
    if (subclassCode === "500") {
      assertCondition(draft.sections.some((section) => section.key === "confirmation_of_enrolment"), `${subclassCode}: dedicated CoE section missing`);
    }
    if (draft.sections.some((section) => section.key === "english_language")) {
      assertCondition(serialized.includes("Automated score warning for staff review"), `${subclassCode}: English score/warning presentation missing`);
    }
    assertCondition(draft.sections.some((section) => section.key === "client_confirmations"), `${subclassCode}: client confirmation section missing`);
    assertCondition(serialized.includes("Dummy Applicant"), `${subclassCode}: approved field did not appear`);
    assertCondition(serialized.includes("[MISSING]") || serialized.includes("NOT_FOUND_IN_APPROVED_EVIDENCE"), `${subclassCode}: missing markers not present`);
    assertCondition(serialized.includes("CLIENT_CONFIRMATION_REQUIRED"), `${subclassCode}: client confirmation marker missing`);
    assertCondition(serialized.includes("AGENT_REVIEW_REQUIRED"), `${subclassCode}: agent review marker missing`);
    assertCondition(serialized.includes("UNSAFE_TO_AUTOFILL"), `${subclassCode}: unsafe autofill marker missing`);
    assertCondition(serialized.includes("Ready for agent final review") || serialized.includes("Blocked - missing critical evidence"), `${subclassCode}: safety wording missing`);
    scanNoForbiddenText(serialized, subclassCode);
    console.log(`PASS ${subclassCode}: ${draft.sections.length} sections, ${draft.documentMatrix.length} document requirements`);
  }
  console.log("Full application draft readiness PASS");
}

main().catch((error) => {
  console.error("Full application draft readiness FAIL");
  console.error(error);
  process.exit(1);
});
