export type OfficialFormMappingHint = {
  fieldId: string;
  label: string;
  source: "VERIFIED_FIELD" | "APPROVED_WORKING_COPY" | "CLIENT_CONFIRMATION" | "WORKSPACE_PROFILE";
  reviewRequired?: boolean;
};

export const OFFICIAL_FORM_MAPPING_HINTS: Record<string, OfficialFormMappingHint[]> = {
  "956": [
    { fieldId: "agent.full_name", label: "Agent full name", source: "WORKSPACE_PROFILE" },
    { fieldId: "agent.marn", label: "MARN", source: "WORKSPACE_PROFILE" },
    { fieldId: "agent.organisation", label: "Organisation", source: "WORKSPACE_PROFILE" },
    { fieldId: "agent.email", label: "Email", source: "WORKSPACE_PROFILE" },
    { fieldId: "agent.phone", label: "Phone", source: "WORKSPACE_PROFILE" },
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.dob", label: "Applicant date of birth", source: "VERIFIED_FIELD", reviewRequired: true }
  ],
  "956A": [
    { fieldId: "authorised_recipient.full_name", label: "Authorised recipient full name", source: "WORKSPACE_PROFILE" },
    { fieldId: "authorised_recipient.email", label: "Authorised recipient email", source: "WORKSPACE_PROFILE" },
    { fieldId: "authorised_recipient.phone", label: "Authorised recipient phone", source: "WORKSPACE_PROFILE" },
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" }
  ],
  "80": [
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.aliases", label: "Other names / aliases", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "applicant.dob", label: "Applicant date of birth", source: "VERIFIED_FIELD", reviewRequired: true },
    { fieldId: "applicant.citizenship", label: "Citizenship", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.address_history", label: "Address history", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "applicant.travel_history", label: "Travel history", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "1221": [
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.dob", label: "Applicant date of birth", source: "VERIFIED_FIELD", reviewRequired: true },
    { fieldId: "applicant.passport_number", label: "Passport number", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.nationality", label: "Nationality", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.address", label: "Current address", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "1229": [
    { fieldId: "child.full_name", label: "Child full name", source: "VERIFIED_FIELD" },
    { fieldId: "child.dob", label: "Child date of birth", source: "VERIFIED_FIELD", reviewRequired: true },
    { fieldId: "child.passport_number", label: "Child passport number", source: "VERIFIED_FIELD" },
    { fieldId: "parent.consent_name", label: "Consenting parent / guardian name", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "157A": [
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "applicant.dob", label: "Applicant date of birth", source: "VERIFIED_FIELD", reviewRequired: true },
    { fieldId: "passport.number", label: "Passport number", source: "VERIFIED_FIELD" },
    { fieldId: "contact.email", label: "Email", source: "VERIFIED_FIELD" },
    { fieldId: "contact.phone", label: "Phone", source: "VERIFIED_FIELD" },
    { fieldId: "education.provider", label: "Provider", source: "APPROVED_WORKING_COPY" },
    { fieldId: "education.coe_number", label: "CoE number", source: "APPROVED_WORKING_COPY" },
    { fieldId: "insurance.provider", label: "OSHC provider", source: "APPROVED_WORKING_COPY" }
  ],
  "1419": [
    { fieldId: "applicant.full_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "passport.number", label: "Passport number", source: "VERIFIED_FIELD" },
    { fieldId: "visitor.purpose", label: "Purpose of visit", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "visitor.funds", label: "Available funds", source: "APPROVED_WORKING_COPY", reviewRequired: true },
    { fieldId: "visitor.home_ties", label: "Home ties", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "888": [
    { fieldId: "partner.applicant_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "partner.sponsor_name", label: "Sponsor full name", source: "VERIFIED_FIELD" },
    { fieldId: "relationship.start_date", label: "Relationship start date", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "witness.full_name", label: "Witness full name", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "47SP": [
    { fieldId: "partner.applicant_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "partner.sponsor_name", label: "Sponsor full name", source: "VERIFIED_FIELD" },
    { fieldId: "relationship.start_date", label: "Relationship start date", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "contact.address", label: "Residential address", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "40SP": [
    { fieldId: "sponsor.full_name", label: "Sponsor full name", source: "VERIFIED_FIELD" },
    { fieldId: "sponsor.status", label: "Sponsor citizenship / PR status", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "sponsor.address", label: "Sponsor residential address", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "47CH": [
    { fieldId: "child.full_name", label: "Child full name", source: "VERIFIED_FIELD" },
    { fieldId: "child.dob", label: "Child date of birth", source: "VERIFIED_FIELD", reviewRequired: true },
    { fieldId: "child.relationship", label: "Relationship to sponsor", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "40CH": [
    { fieldId: "sponsor.full_name", label: "Sponsor full name", source: "VERIFIED_FIELD" },
    { fieldId: "sponsor.address", label: "Sponsor address", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ],
  "47PA": [
    { fieldId: "parent.applicant_name", label: "Applicant full name", source: "VERIFIED_FIELD" },
    { fieldId: "family.balance_of_family", label: "Balance of family", source: "CLIENT_CONFIRMATION", reviewRequired: true },
    { fieldId: "family.assurance_of_support", label: "Assurance of support", source: "CLIENT_CONFIRMATION", reviewRequired: true }
  ]
};

export function getOfficialFormMappingHints(formNumber: string) {
  return OFFICIAL_FORM_MAPPING_HINTS[formNumber] ?? [];
}
