import { insuranceFundingSections, req } from "./common";
import { form956Req, makeWorkflowTemplate, parentChildSection } from "./expanded-common";

export const subclass870FullDraftTemplate = makeWorkflowTemplate({
  codes: ["870"],
  title: "Sponsored Parent Temporary visa (Subclass 870) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("sponsor_approval", "Sponsor approval / sponsor evidence", "Forms", "REQUIRED", ["sponsor approval", "sponsor"]),
    req("parent_child", "Parent-child relationship evidence", "Relationship", "REQUIRED", ["birth certificate", "relationship"], undefined, "relationship_family"),
    req("financial_insurance", "Financial / insurance evidence", "Financial", "RECOMMENDED", ["bank", "insurance", "funds"], undefined, "financial_capacity"),
    req("health_character", "Health / character evidence", "Health / Insurance", "CONDITIONAL", ["health", "police", "character"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [parentChildSection, ...insuranceFundingSections]
});
