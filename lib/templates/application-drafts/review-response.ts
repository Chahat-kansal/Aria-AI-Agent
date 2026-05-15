import { req } from "./common";
import { form956Req, makeWorkflowTemplate, reviewResponseSection } from "./expanded-common";

export const reviewResponseFullDraftTemplate = makeWorkflowTemplate({
  codes: ["AAT", "ART", "REVIEW", "MINISTERIAL", "BRIDGING", "PIC4020", "NATURAL_JUSTICE"],
  title: "Review / natural justice response support pack",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("decision", "Refusal / cancellation / notice letter", "Forms", "REQUIRED", ["refusal", "cancellation", "natural justice", "pic 4020", "notice"]),
    req("application_record", "Application record", "Forms", "RECOMMENDED", ["application record", "immiaccount"]),
    req("deadline", "Submission / review deadline", "Forms", "REQUIRED", ["deadline", "due date"]),
    req("correspondence", "Tribunal / department correspondence", "Forms", "RECOMMENDED", ["tribunal", "department", "correspondence"]),
    req("evidence", "Evidence addressing refusal or issue reasons", "Other Evidence", "REQUIRED", ["evidence", "supporting"]),
    req("client_statement", "Client statement", "Statements / Declarations", "REQUIRED", ["client statement", "response"], undefined, "document_accuracy"),
    req("chronology", "Chronology", "Statements / Declarations", "RECOMMENDED", ["chronology", "timeline"], undefined, "document_accuracy"),
    form956Req()
  ],
  sections: [reviewResponseSection]
});
