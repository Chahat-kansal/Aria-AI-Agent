import { req } from "./common";
import { form956Req, makeWorkflowTemplate, parentChildSection } from "./expanded-common";

export const subclass101802FullDraftTemplate = makeWorkflowTemplate({
  codes: ["101", "802"],
  title: "Child visa (Subclass 101/802) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("child_passport", "Child passport", "Identity", "REQUIRED", ["passport", "child"]),
    req("birth_certificate", "Birth certificate", "Relationship", "REQUIRED", ["birth certificate"], undefined, "relationship_family"),
    req("parent_sponsor", "Parent / sponsor identity and status", "Identity", "REQUIRED", ["parent", "sponsor", "citizenship"], undefined, "relationship_family"),
    req("custody", "Custody / parental responsibility", "Relationship", "CONDITIONAL", ["custody", "parental responsibility"], undefined, "relationship_family"),
    req("adoption", "Adoption evidence if relevant", "Relationship", "CONDITIONAL", ["adoption"]),
    req("health_character", "Health / character", "Health / Insurance", "CONDITIONAL", ["health", "police", "character"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [parentChildSection]
});
