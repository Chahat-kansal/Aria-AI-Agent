import { createTemplate, educationSection, englishSection, employmentSection, insuranceFundingSections, req, skillsSection, withCommonSections } from "./common";

export const subclass485FullDraftTemplate = createTemplate(
  ["485"],
  "Temporary Graduate visa (Subclass 485) staff review application draft",
  [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("english", "English test", "Education", "REQUIRED", ["pte", "ielts", "toefl", "oet", "english"]),
    req("degree", "Australian degree / completion letter / transcripts", "Education", "REQUIRED", ["completion", "degree", "transcript", "award"]),
    req("skills", "Skills assessment if relevant", "Employment", "CONDITIONAL", ["skills assessment", "assessment"]),
    req("employment", "Employment references if relevant", "Employment", "CONDITIONAL", ["employment reference", "reference"]),
    req("cv", "Resume / CV", "Employment", "RECOMMENDED", ["resume", "cv"]),
    req("afp", "AFP / police clearance where relevant", "Health / Insurance", "CONDITIONAL", ["afp", "police", "clearance"], undefined, "character_declaration"),
    req("insurance", "Health insurance", "Health / Insurance", "REQUIRED", ["insurance", "ovhc", "oshc"], undefined, "insurance"),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"]),
    req("subsequent", "485 subsequent entrant documents", "Relationship", "CONDITIONAL", ["dependent", "dependant", "birth certificate", "primary holder"], "Not configured as a standalone flow unless the matter is explicitly set up for a subsequent entrant.")
  ],
  withCommonSections([
    englishSection,
    educationSection,
    employmentSection,
    skillsSection,
    ...insuranceFundingSections
  ])
);
