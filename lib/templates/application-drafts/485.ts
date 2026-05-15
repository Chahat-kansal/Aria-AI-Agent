import { createTemplate, educationSection, englishSection, employmentSection, field, insuranceFundingSections, req, skillsSection, withCommonSections } from "./common";

const subsequentEntrantSection = {
  key: "subsequent_entrant_context",
  title: "485 subsequent entrant context",
  description: "Only use this section where the matter is explicitly a subsequent entrant workflow. Relationship and custody facts stay source-backed and review-required.",
  fields: [
    field("subsequent.primary_holder_name", "Primary visa holder", { aliases: ["primary_holder", "primary_applicant"], sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("subsequent.primary_holder_visa_grant", "Primary holder visa grant evidence", { aliases: ["primary_visa_grant", "primary_holder_grant"], sourceRequired: true }),
    field("subsequent.relationship_to_primary", "Relationship to primary holder", { aliases: ["relationship_to_primary", "dependant_relationship"], sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("subsequent.birth_or_relationship_evidence", "Birth / relationship evidence", { aliases: ["birth_certificate", "relationship_evidence"], sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("subsequent.custody_parental_responsibility", "Custody / parental responsibility if relevant", { aliases: ["custody", "parental_responsibility"], unsafe: true, clientConfirmationCategory: "relationship_family" })
  ]
};

export const subclass485FullDraftTemplate = createTemplate(
  ["485", "485_SUBSEQUENT_ENTRANT", "subseq"],
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
    subsequentEntrantSection,
    educationSection,
    employmentSection,
    skillsSection,
    ...insuranceFundingSections
  ])
);
