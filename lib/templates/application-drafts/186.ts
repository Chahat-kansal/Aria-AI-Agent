import { createTemplate, employmentSection, englishSection, field, req, skillsSection, withCommonSections } from "./common";

const ensNominationSection = {
  key: "ens_nomination_employer",
  title: "Sponsor / nomination / employer",
  fields: [
    field("employment.employer_name", "Employer / sponsor", { sourceRequired: true }),
    field("sponsor.abn", "ABN / ACN", { sourceRequired: true }),
    field("sponsor.nomination_details", "Nomination details", { sourceRequired: true }),
    field("sponsor.stream", "TRT / Direct Entry stream", { sourceRequired: true }),
    field("employment.position_title", "Position", { sourceRequired: true }),
    field("employment.work_location", "Work location", { sourceRequired: true }),
    field("employment.salary", "Salary", { sourceRequired: true }),
    field("employment.contract_details", "Employment contract", { sourceRequired: true }),
    field("employment.years_with_employer", "Years with employer", { sourceRequired: true }),
    field("applicant.age", "Age and age warning", { sourceRequired: true })
  ]
};

export const subclass186FullDraftTemplate = createTemplate(
  ["186"],
  "Employer Nomination Scheme (Subclass 186) staff review application draft",
  [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("english", "English test", "Education", "RECOMMENDED", ["english", "pte", "ielts", "toefl", "oet"]),
    req("cv", "Resume / CV", "Employment", "REQUIRED", ["resume", "cv"]),
    req("payslips", "Payslips / employment evidence", "Employment", "REQUIRED", ["payslip", "employment", "tax", "super"]),
    req("skills", "Skills assessment", "Employment", "RECOMMENDED", ["skills assessment"]),
    req("nomination", "Nomination / employer evidence", "Forms", "REQUIRED", ["nomination", "employer"]),
    req("contract", "Employment contract", "Employment", "REQUIRED", ["contract", "employment agreement"]),
    req("health", "Health examination if relevant", "Health / Insurance", "CONDITIONAL", ["health", "medical"]),
    req("police", "Police clearance", "Health / Insurance", "RECOMMENDED", ["police", "afp", "clearance"], undefined, "character_declaration"),
    req("age_exemption", "Age/exemption evidence if relevant", "Identity", "CONDITIONAL", ["age exemption", "exemption"]),
    req("form956", "Form 956", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([englishSection, employmentSection, skillsSection, ensNominationSection])
);
