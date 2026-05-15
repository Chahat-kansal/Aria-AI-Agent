import { coeSection, createTemplate, educationSection, englishSection, field, insuranceFundingSections, req, withCommonSections } from "./common";

export const subclass500FullDraftTemplate = createTemplate(
  ["500"],
  "Student visa (Subclass 500) staff review application draft",
  [
    req("passport", "Passport", "Identity", "REQUIRED", ["passport", "identity"]),
    req("english", "PTE / IELTS / English test", "Education", "RECOMMENDED", ["pte", "ielts", "toefl", "oet", "english"]),
    req("coe", "Confirmation of Enrolment", "Education", "REQUIRED", ["coe", "confirmation of enrolment", "enrolment"]),
    req("financial", "Bank statements / financial capacity", "Financial", "REQUIRED", ["bank", "fund", "financial", "balance"], undefined, "financial_capacity"),
    req("gs", "Statement of Purpose / Genuine Student statement", "Statements / Declarations", "REQUIRED", ["genuine student", "statement of purpose", "sop"], undefined, "study_gte"),
    req("oshc", "OSHC certificate", "Health / Insurance", "REQUIRED", ["oshc", "insurance", "health cover"], undefined, "insurance"),
    req("transcripts", "Academic transcripts", "Education", "RECOMMENDED", ["transcript", "academic record"]),
    req("police", "Police clearance if relevant", "Health / Insurance", "CONDITIONAL", ["police", "afp", "clearance"], undefined, "character_declaration"),
    req("form956", "Form 956 if agent appointed", "Forms", "CONDITIONAL", ["form 956", "956", "agent"])
  ],
  withCommonSections([
    englishSection,
    coeSection,
    educationSection,
    ...insuranceFundingSections,
    {
      key: "student_declarations",
      title: "Student / visa-specific declarations",
      fields: [
        field("statement.genuine_student", "Genuine Student statement", { unsafe: true, clientConfirmationCategory: "study_gte" }),
        field("student.temporary_visa_understanding", "Temporary visa understanding", { unsafe: true, clientConfirmationCategory: "study_gte" }),
        field("student.no_further_visa_guarantee", "No guarantee of further visa acknowledgement", { unsafe: true, clientConfirmationCategory: "study_gte" }),
        field("student.conditions_awareness", "Visa conditions awareness", { unsafe: true, clientConfirmationCategory: "study_gte" }),
        field("student.work_condition_awareness", "Work condition awareness", { unsafe: true, clientConfirmationCategory: "study_gte" }),
        field("student.no_further_stay_conditions", "No Further Stay conditions if relevant", { unsafe: true, clientConfirmationCategory: "study_gte" })
      ]
    }
  ])
);
