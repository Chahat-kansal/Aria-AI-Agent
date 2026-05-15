import { req } from "./common";
import { form956Req, makeWorkflowTemplate, reviewResponseSection } from "./expanded-common";

export const section56FullDraftTemplate = makeWorkflowTemplate({
  codes: ["S56", "SECTION_56"],
  title: "Section 56 request response support pack",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("request_letter", "Section 56 request letter", "Forms", "REQUIRED", ["section 56", "s56", "request"]),
    req("due_date", "Due date", "Forms", "REQUIRED", ["due date", "deadline"]),
    req("requested_documents", "Requested documents", "Other Evidence", "REQUIRED", ["requested", "document"]),
    req("provided_evidence", "Evidence provided", "Other Evidence", "REQUIRED", ["evidence", "provided"]),
    req("outstanding_items", "Outstanding items", "Other Evidence", "RECOMMENDED", ["outstanding", "missing"]),
    req("response_submission", "Draft response / submission", "Statements / Declarations", "RECOMMENDED", ["response", "submission"], undefined, "document_accuracy"),
    form956Req()
  ],
  sections: [reviewResponseSection]
});
