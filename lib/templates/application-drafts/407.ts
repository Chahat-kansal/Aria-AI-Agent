import { educationSection, employmentSection, englishSection, req } from "./common";
import { activitySection, form956Req, makeWorkflowTemplate } from "./expanded-common";

export const subclass407FullDraftTemplate = makeWorkflowTemplate({
  codes: ["407"],
  title: "Training visa (Subclass 407) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("sponsor_nomination", "Sponsor / nomination evidence", "Forms", "REQUIRED", ["sponsor", "nomination", "407"]),
    req("training_plan", "Training plan", "Education", "REQUIRED", ["training plan", "program"]),
    req("qualifications", "Qualifications", "Education", "RECOMMENDED", ["qualification", "certificate", "transcript"]),
    req("employment", "Employment history", "Employment", "RECOMMENDED", ["reference", "employment", "resume", "cv"]),
    req("english", "English evidence if relevant", "Education", "CONDITIONAL", ["english", "ielts", "pte"]),
    req("insurance", "Health insurance", "Health / Insurance", "REQUIRED", ["insurance", "oshc", "ovhc"], undefined, "insurance"),
    req("police_health", "Police / health where relevant", "Health / Insurance", "CONDITIONAL", ["police", "health", "clearance"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [activitySection, educationSection, employmentSection, englishSection]
});
