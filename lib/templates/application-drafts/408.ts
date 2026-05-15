import { employmentSection, req } from "./common";
import { activitySection, form956Req, makeWorkflowTemplate } from "./expanded-common";

export const subclass408FullDraftTemplate = makeWorkflowTemplate({
  codes: ["408"],
  title: "Temporary Activity visa (Subclass 408) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("activity_letter", "Activity / invitation / support letter", "Travel", "REQUIRED", ["invitation", "support letter", "activity"]),
    req("supporter", "Sponsor / supporter evidence", "Forms", "CONDITIONAL", ["sponsor", "supporter"]),
    req("financial", "Financial capacity", "Financial", "RECOMMENDED", ["bank", "funds", "financial"], undefined, "financial_capacity"),
    req("insurance", "Health insurance", "Health / Insurance", "RECOMMENDED", ["insurance", "health"], undefined, "insurance"),
    req("experience", "Employment / experience evidence", "Employment", "RECOMMENDED", ["experience", "reference", "employment"]),
    req("police_health", "Police / health where relevant", "Health / Insurance", "CONDITIONAL", ["police", "health"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [activitySection, employmentSection]
});
