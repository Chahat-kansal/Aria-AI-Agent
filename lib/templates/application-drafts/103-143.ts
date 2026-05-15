import { insuranceFundingSections, req } from "./common";
import { form956Req, makeWorkflowTemplate, parentChildSection } from "./expanded-common";

export const subclass103143FullDraftTemplate = makeWorkflowTemplate({
  codes: ["103", "143"],
  title: "Parent visa (Subclass 103/143) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("child_sponsor", "Child sponsor evidence", "Relationship", "REQUIRED", ["child", "sponsor", "citizenship"], undefined, "relationship_family"),
    req("balance_family", "Balance of family evidence", "Relationship", "REQUIRED", ["balance of family", "family"], undefined, "relationship_family"),
    req("relationship", "Relationship evidence", "Relationship", "REQUIRED", ["birth certificate", "relationship"], undefined, "relationship_family"),
    req("aos", "Assurance of support if relevant", "Financial", "CONDITIONAL", ["assurance of support", "aos"], undefined, "financial_capacity"),
    req("health_character", "Health / character", "Health / Insurance", "CONDITIONAL", ["health", "police", "character"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [parentChildSection, ...insuranceFundingSections]
});
