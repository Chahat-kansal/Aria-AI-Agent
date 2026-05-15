import { employmentSection, englishSection, req, skillsSection } from "./common";
import { form956Req, makeWorkflowTemplate, sponsorshipVariantSection } from "./expanded-common";

export const subclass494FullDraftTemplate = makeWorkflowTemplate({
  codes: ["494"],
  title: "Skilled Employer Sponsored Regional (Subclass 494) staff review application draft",
  supportLevel: "FULL_STAFF_DRAFT",
  supportNotes: "Full staff-draft structure is configured for Subclass 494 with employer, regional, skills, English, declaration, and document matrix sections. Field values remain source-backed and agent-review required.",
  documents: [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("employer", "Employer / sponsor evidence", "Forms", "REQUIRED", ["employer", "sponsor", "standard business sponsor"]),
    req("nomination", "Nomination details", "Forms", "REQUIRED", ["nomination", "position"]),
    req("position_salary", "Position / salary evidence", "Employment", "REQUIRED", ["position", "salary", "market salary"]),
    req("contract", "Employment contract", "Employment", "REQUIRED", ["contract", "employment agreement"]),
    req("skills", "Skills assessment", "Employment", "REQUIRED", ["skills assessment"]),
    req("english", "English", "Education", "RECOMMENDED", ["english", "ielts", "pte", "toefl"]),
    req("regional", "Regional location evidence", "Employment", "REQUIRED", ["regional", "designated regional", "work location"]),
    req("qualifications", "Qualifications / employment references", "Employment", "RECOMMENDED", ["qualification", "reference", "cv", "resume"]),
    req("police_health", "Police / health", "Health / Insurance", "CONDITIONAL", ["police", "health"], undefined, "character_declaration"),
    form956Req()
  ],
  sections: [sponsorshipVariantSection, employmentSection, skillsSection, englishSection]
});
