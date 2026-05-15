import { createTemplate, employmentSection, englishSection, field, req, skillsSection, withCommonSections } from "./common";

const sponsorNominationSection = {
  key: "sponsor_nomination_employer",
  title: "Sponsor / nomination / employer",
  fields: [
    field("sponsor.business_name", "Sponsor / employer name", { sourceRequired: true }),
    field("sponsor.abn", "ABN / ACN", { sourceRequired: true }),
    field("sponsor.nomination_details", "Nomination details", { sourceRequired: true }),
    field("sponsor.labour_market_testing", "Labour market testing evidence", { sourceRequired: true }),
    field("sponsor.market_rate", "Market salary rate evidence", { sourceRequired: true }),
    field("sponsor.occupation_notes", "Caveats / occupation notes", { sourceRequired: true }),
    field("employment.contract_details", "Employment contract", { sourceRequired: true }),
    field("employment.salary", "Salary", { sourceRequired: true }),
    field("employment.work_location", "Work location", { sourceRequired: true })
  ]
};

export const subclass482FullDraftTemplate = createTemplate(
  ["482", "482_SUBSEQUENT_ENTRANT"],
  "Skills in Demand / TSS (Subclass 482) staff review application draft",
  [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("english", "English test", "Education", "RECOMMENDED", ["english", "pte", "ielts", "toefl", "oet"]),
    req("cv", "Resume / CV", "Employment", "REQUIRED", ["resume", "cv"]),
    req("payslips", "Payslips", "Employment", "RECOMMENDED", ["payslip", "pay slip"]),
    req("references", "Employment references", "Employment", "REQUIRED", ["employment reference", "reference"]),
    req("skills", "Skills assessment if relevant", "Employment", "CONDITIONAL", ["skills assessment"]),
    req("sbs", "Sponsor / SBS approval", "Forms", "REQUIRED", ["sbs", "standard business sponsor", "sponsor approval"]),
    req("contract", "Employment contract", "Employment", "REQUIRED", ["contract", "employment agreement"]),
    req("nomination", "Nomination details", "Forms", "REQUIRED", ["nomination"]),
    req("police_health", "Police / health where relevant", "Health / Insurance", "CONDITIONAL", ["police", "health", "clearance"], undefined, "character_declaration"),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([englishSection, employmentSection, skillsSection, sponsorNominationSection])
);
