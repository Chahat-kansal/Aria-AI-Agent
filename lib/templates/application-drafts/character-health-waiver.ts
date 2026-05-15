import { req } from "./common";
import { form956Req, makeWorkflowTemplate, reviewResponseSection } from "./expanded-common";

export const characterHealthWaiverFullDraftTemplate = makeWorkflowTemplate({
  codes: ["CHARACTER_RESPONSE", "HEALTH_WAIVER"],
  title: "Character / health waiver response support pack",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("notice", "Notice / health waiver request / character issue letter", "Forms", "REQUIRED", ["notice", "health waiver", "character"]),
    req("issue_summary", "Issue summary evidence", "Statements / Declarations", "REQUIRED", ["issue", "allegation", "summary"], undefined, "document_accuracy"),
    req("client_response", "Client response", "Statements / Declarations", "REQUIRED", ["client response", "statement"], undefined, "document_accuracy"),
    req("supporting_evidence", "Supporting evidence", "Other Evidence", "REQUIRED", ["supporting", "evidence"]),
    req("chronology", "Chronology", "Statements / Declarations", "RECOMMENDED", ["chronology", "timeline"]),
    req("declarations", "Declarations", "Statements / Declarations", "CONDITIONAL", ["declaration"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [reviewResponseSection]
});
