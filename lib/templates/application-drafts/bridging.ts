import { req } from "./common";
import { form956Req, makeWorkflowTemplate, sponsorshipVariantSection } from "./expanded-common";

export const bridgingVisaFullDraftTemplate = makeWorkflowTemplate({
  codes: ["BRIDGING", "BVA", "BVB", "BVC", "BVE"],
  title: "Bridging visa preparation checklist and staff review draft",
  supportLevel: "CHECKLIST_ONLY",
  supportNotes: "Bridging visa workflows are configured as checklist/support preparation only. Aria organises evidence and missing items but does not claim full application-draft automation for these workflows.",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("current_visa", "Current visa / status evidence", "Travel", "REQUIRED", ["current visa", "vevo", "grant"]),
    req("pending_application", "Pending application / review evidence", "Forms", "REQUIRED", ["pending application", "review", "appeal"]),
    req("travel_need", "Travel need evidence for BVB if relevant", "Travel", "CONDITIONAL", ["travel", "itinerary", "compassionate"]),
    req("substantial_reasons", "Substantial reasons / vulnerability evidence if relevant", "Statements / Declarations", "CONDITIONAL", ["substantial", "vulnerable", "reasons"], undefined, "document_accuracy"),
    form956Req()
  ],
  sections: [sponsorshipVariantSection]
});
