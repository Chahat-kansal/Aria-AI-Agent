import { req } from "./common";
import { form956Req, makeWorkflowTemplate } from "./expanded-common";
import { partnerRelationshipSection } from "./820-801";

export const subclass300FullDraftTemplate = makeWorkflowTemplate({
  codes: ["300"],
  title: "Prospective Marriage visa (Subclass 300) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport - applicant", "Identity", "REQUIRED", ["passport", "identity"]),
    req("sponsor_identity", "Sponsor identity/status", "Identity", "REQUIRED", ["sponsor", "citizenship", "passport"], undefined, "relationship_family"),
    req("intent_to_marry", "Intention to marry evidence", "Relationship", "REQUIRED", ["noim", "marry", "wedding", "marriage"], undefined, "relationship_family"),
    req("relationship", "Relationship evidence", "Relationship", "REQUIRED", ["relationship", "photos", "statement"], undefined, "relationship_family"),
    req("meeting", "Meeting in person evidence", "Relationship", "REQUIRED", ["travel", "meeting", "photos"], undefined, "relationship_family"),
    req("arrangements", "NOIM / marriage arrangements if available", "Forms", "RECOMMENDED", ["noim", "celebrant", "venue"]),
    req("police_health", "Police / health", "Health / Insurance", "CONDITIONAL", ["police", "health"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [partnerRelationshipSection]
});
