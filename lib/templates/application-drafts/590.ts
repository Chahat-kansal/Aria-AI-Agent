import { insuranceFundingSections, req } from "./common";
import { form956Req, makeWorkflowTemplate, parentChildSection } from "./expanded-common";

export const subclass590FullDraftTemplate = makeWorkflowTemplate({
  codes: ["590"],
  title: "Student Guardian visa (Subclass 590) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("relationship_student", "Relationship to student evidence", "Relationship", "REQUIRED", ["birth certificate", "relationship", "student"], undefined, "relationship_family"),
    req("student_visa_coe", "Student visa / CoE evidence", "Education", "REQUIRED", ["coe", "student visa", "enrolment"]),
    req("financial", "Financial capacity", "Financial", "REQUIRED", ["bank", "financial", "funds"], undefined, "financial_capacity"),
    req("insurance", "Health insurance", "Health / Insurance", "REQUIRED", ["oshc", "ovhc", "insurance"], undefined, "insurance"),
    req("welfare", "Accommodation / welfare evidence", "Other Evidence", "RECOMMENDED", ["accommodation", "welfare", "guardian"]),
    req("police", "Character / police evidence where relevant", "Health / Insurance", "CONDITIONAL", ["police", "character", "clearance"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [parentChildSection, ...insuranceFundingSections]
});
