import { employmentSection, req } from "./common";
import { businessTalentSection, form956Req, makeWorkflowTemplate } from "./expanded-common";

export const businessTalentFullDraftTemplate = makeWorkflowTemplate({
  codes: ["188", "858"],
  title: "Business / talent visa staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("nomination_invitation", "Nomination / invitation / endorsement evidence", "Forms", "REQUIRED", ["nomination", "invitation", "endorsement"]),
    req("business_records", "Business / investment / achievement records", "Employment", "REQUIRED", ["business", "investment", "achievement", "award"]),
    req("financial_records", "Financial / asset / turnover evidence", "Financial", "RECOMMENDED", ["asset", "turnover", "financial"]),
    req("statement", "Applicant statement / proposed activity", "Statements / Declarations", "RECOMMENDED", ["statement", "proposal"], undefined, "document_accuracy"),
    req("health_character", "Health / character", "Health / Insurance", "CONDITIONAL", ["health", "police", "character"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [businessTalentSection, employmentSection]
});
