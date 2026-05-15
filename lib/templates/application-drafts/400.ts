import { employmentSection, insuranceFundingSections, req } from "./common";
import { activitySection, form956Req, makeWorkflowTemplate } from "./expanded-common";

export const subclass400FullDraftTemplate = makeWorkflowTemplate({
  codes: ["400"],
  title: "Short Stay Specialist visa (Subclass 400) staff review preparation draft",
  supportLevel: "CHECKLIST_AND_INTAKE",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("engagement", "Invitation / engagement letter", "Travel", "REQUIRED", ["invitation", "engagement", "contract"]),
    req("specialist_work", "Specialist work evidence", "Employment", "REQUIRED", ["specialist", "duties", "work"]),
    req("employment", "Employment evidence", "Employment", "RECOMMENDED", ["employment", "reference"]),
    req("itinerary", "Itinerary", "Travel", "RECOMMENDED", ["itinerary", "flight"]),
    req("financial", "Financial capacity", "Financial", "RECOMMENDED", ["bank", "funds"], undefined, "financial_capacity"),
    req("insurance", "Health insurance", "Health / Insurance", "RECOMMENDED", ["insurance", "health"], undefined, "insurance"),
    form956Req()
  ],
  sections: [activitySection, employmentSection, ...insuranceFundingSections]
});
