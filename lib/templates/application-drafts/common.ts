import type {
  FullApplicationDraftTemplate,
  FullDraftDocumentRequirement,
  FullDraftDocumentRequirementStatus,
  FullDraftFieldTemplate,
  FullDraftSectionTemplate
} from "@/lib/services/full-application-draft-types";

export function req(
  key: string,
  label: string,
  category: string,
  status: FullDraftDocumentRequirementStatus,
  keywords: string[],
  description?: string,
  clientConfirmationCategory?: string
): FullDraftDocumentRequirement {
  return { key, label, category, status, keywords, description, clientConfirmationCategory };
}

export function field(
  key: string,
  label: string,
  options: Partial<FullDraftFieldTemplate> = {}
): FullDraftFieldTemplate {
  return { key, label, ...options };
}

export const coverSections: FullDraftSectionTemplate[] = [
  {
    key: "application_context",
    title: "Application context",
    description: "Matter-level context used to orient the staff review draft.",
    fields: [
      field("matter.visaSubclass", "Visa subclass", { fallback: "matter", required: true }),
      field("matter.visaStream", "Stream", { fallback: "matter" }),
      field("contact.current_location", "Current location / onshore-offshore context", { sourceRequired: true }),
      field("visa.current_visa_subclass", "Current visa status", { sourceRequired: true }),
      field("matter.stage", "Current matter stage", { fallback: "matter" }),
      field("matter.status", "Current matter status", { fallback: "matter" })
    ]
  },
  {
    key: "primary_applicant_identity",
    title: "Primary applicant identity",
    description: "Identity facts should be verified against approved passport or identity evidence.",
    fields: [
      field("applicant.full_name", "Family and given names", { fallback: "client", required: true, sourceRequired: true }),
      field("applicant.date_of_birth", "Date of birth", { fallback: "client", required: true, sourceRequired: true }),
      field("applicant.sex", "Sex", { sourceRequired: true }),
      field("applicant.nationality", "Nationality", { fallback: "client", required: true, sourceRequired: true }),
      field("applicant.country_of_birth", "Country of birth", { sourceRequired: true }),
      field("applicant.place_of_birth", "Place of birth", { sourceRequired: true }),
      field("applicant.passport_number", "Passport number", { required: true, sourceRequired: true }),
      field("applicant.passport_country", "Passport country", { sourceRequired: true }),
      field("applicant.passport_issue_date", "Passport issue date", { sourceRequired: true }),
      field("applicant.passport_expiry", "Passport expiry", { sourceRequired: true }),
      field("applicant.relationship_status", "Relationship status", { clientConfirmationCategory: "relationship_family" }),
      field("applicant.aliases", "Aliases / other names", { sourceRequired: true })
    ]
  },
  {
    key: "contact_details",
    title: "Contact details",
    description: "Contact details may come from matter metadata or confirmed client responses.",
    fields: [
      field("contact.email", "Email", { fallback: "client", sourceRequired: true }),
      field("contact.phone", "Phone", { fallback: "client", sourceRequired: true }),
      field("contact.residential_address", "Residential address", { sourceRequired: true, clientConfirmationCategory: "personal_details" }),
      field("contact.postal_address", "Postal address", { sourceRequired: true, clientConfirmationCategory: "personal_details" }),
      field("contact.australian_address", "Australian address", { sourceRequired: true, clientConfirmationCategory: "personal_details" }),
      field("contact.home_country_address", "Home country address", { sourceRequired: true, clientConfirmationCategory: "personal_details" })
    ]
  },
  {
    key: "registered_migration_agent",
    title: "Registered migration agent / Form 956",
    description: "Firm and agent details come from workspace and assigned user profile only.",
    fields: [
      field("agent.authorised_recipient_status", "Authorised recipient status", { sourceRequired: true }),
      field("agent.name", "Agent name", { fallback: "agent" }),
      field("agent.marn", "MARN", { fallback: "agent", sourceRequired: true }),
      field("workspace.organisation", "Organisation", { fallback: "workspace" }),
      field("workspace.email", "Firm email", { fallback: "workspace" }),
      field("workspace.phone", "Firm phone", { fallback: "workspace" }),
      field("workspace.address", "Firm address", { fallback: "workspace" }),
      field("form956.status", "Form 956 status", { sourceRequired: true })
    ]
  },
  {
    key: "visa_history",
    title: "Visa history",
    description: "Only disclosed or source-backed visa history is shown.",
    fields: [
      field("visa.current_visa_subclass", "Current visa subclass", { fallback: "client", sourceRequired: true }),
      field("visa.grant_number", "Visa grant number", { sourceRequired: true }),
      field("visa.grant_date", "Visa grant date", { sourceRequired: true }),
      field("visa.expiry_date", "Visa expiry", { fallback: "client", sourceRequired: true }),
      field("visa.previous_visas", "Previous visas", { sourceRequired: true }),
      field("visa.refusals_or_cancellations", "Refusals / cancellations disclosed", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("visa.compliance_issues", "Compliance issues disclosed", { unsafe: true, clientConfirmationCategory: "character_declaration" })
    ]
  }
];

export const englishSection: FullDraftSectionTemplate = {
  key: "english_language",
  title: "English language",
  fields: [
    field("english.test_type", "Test type", { sourceRequired: true }),
    field("english.test_date", "Test date", { sourceRequired: true }),
    field("english.reference_number", "Reference number", { sourceRequired: true }),
    field("english.overall_score", "Overall score", { sourceRequired: true }),
    field("english.listening", "Listening", { sourceRequired: true }),
    field("english.reading", "Reading", { sourceRequired: true }),
    field("english.writing", "Writing", { sourceRequired: true }),
    field("english.speaking", "Speaking", { sourceRequired: true }),
    field("english.validity", "Expiry / validity", { sourceRequired: true }),
    field("english.exemption", "English exemption evidence", { sourceRequired: true, clientConfirmationCategory: "document_accuracy" })
  ]
};

export const educationSection: FullDraftSectionTemplate = {
  key: "education_study",
  title: "Education / study",
  fields: [
    field("study.coe_number", "CoE code", { sourceRequired: true }),
    field("study.provider", "Provider / institution", { sourceRequired: true }),
    field("study.course_name", "Course / program", { sourceRequired: true }),
    field("study.cricos", "CRICOS", { sourceRequired: true }),
    field("study.course_start_date", "Course start date", { sourceRequired: true }),
    field("study.course_end_date", "Course end date", { sourceRequired: true }),
    field("study.qualification", "Qualification", { sourceRequired: true }),
    field("study.completion_date", "Completion date", { sourceRequired: true }),
    field("study.transcripts", "Transcripts / completion evidence", { sourceRequired: true }),
    field("study.two_academic_year_requirement", "Two academic year evidence", { sourceRequired: true })
  ]
};

export const employmentSection: FullDraftSectionTemplate = {
  key: "employment_history",
  title: "Employment history",
  fields: [
    field("employment.employer_name", "Employer", { sourceRequired: true }),
    field("employment.nominated_occupation", "Occupation", { sourceRequired: true }),
    field("employment.anzsco", "ANZSCO", { sourceRequired: true }),
    field("employment.position_title", "Position title", { sourceRequired: true }),
    field("employment.duties", "Duties", { sourceRequired: true }),
    field("employment.work_location", "Work location", { sourceRequired: true }),
    field("employment.start_date", "Start date", { sourceRequired: true }),
    field("employment.end_date", "End date", { sourceRequired: true }),
    field("employment.salary", "Salary", { sourceRequired: true }),
    field("employment.weekly_hours", "Weekly hours", { sourceRequired: true }),
    field("employment.references", "References", { sourceRequired: true }),
    field("employment.payslips_tax_super", "Payslips / tax / super evidence", { sourceRequired: true }),
    field("employment.history", "Employment history summary", { sourceRequired: true })
  ]
};

export const skillsSection: FullDraftSectionTemplate = {
  key: "skills_assessment",
  title: "Skills assessment / occupation",
  fields: [
    field("skills.occupation", "Occupation", { sourceRequired: true }),
    field("skills.anzsco", "ANZSCO", { sourceRequired: true }),
    field("skills.assessing_authority", "Assessing body", { sourceRequired: true }),
    field("skills.assessment", "Skills assessment", { sourceRequired: true }),
    field("skills.assessment_reference", "Reference number", { sourceRequired: true }),
    field("skills.assessment_date", "Date", { sourceRequired: true }),
    field("skills.assessment_outcome", "Outcome", { sourceRequired: true }),
    field("skills.assessment_expiry", "Expiry", { sourceRequired: true })
  ]
};

export const insuranceFundingSections: FullDraftSectionTemplate[] = [
  {
    key: "health_insurance",
    title: "Health insurance",
    fields: [
      field("health.oshc_provider", "OSHC / OVHC provider", { sourceRequired: true }),
      field("health.policy_number", "Policy number", { sourceRequired: true }),
      field("health.cover_start", "Cover start", { sourceRequired: true }),
      field("health.cover_end", "Cover end", { sourceRequired: true })
    ]
  },
  {
    key: "funding_financial_capacity",
    title: "Funding / financial capacity",
    fields: [
      field("financial.available_funds", "Available funds", { sourceRequired: true, clientConfirmationCategory: "financial_capacity" }),
      field("financial.currency", "Currency", { sourceRequired: true }),
      field("financial.source_of_funds", "Source of funds", { sourceRequired: true, clientConfirmationCategory: "financial_capacity" }),
      field("financial.sponsor_support", "Sponsor support", { sourceRequired: true, clientConfirmationCategory: "financial_capacity" }),
      field("financial.statement_date", "Statement date", { sourceRequired: true })
    ]
  }
];

export const familySection: FullDraftSectionTemplate = {
  key: "family_dependants",
  title: "Family members / dependants",
  fields: [
    field("family.partner", "Spouse / partner", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.children", "Children", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.dependants", "Other dependants", { sourceRequired: true, clientConfirmationCategory: "relationship_family" }),
    field("family.members_overseas", "Other family members", { sourceRequired: true, clientConfirmationCategory: "relationship_family" })
  ]
};

export const declarationSections: FullDraftSectionTemplate[] = [
  {
    key: "health_character_declarations",
    title: "Health / character / declarations",
    description: "Declaration answers are never guessed. They remain client-confirmation and agent-review required unless explicitly verified.",
    fields: [
      field("health.declarations", "Health conditions / medical treatment", { unsafe: true, clientConfirmationCategory: "health_declaration" }),
      field("health.tb_or_chest_xray", "TB / chest x-ray disclosures", { unsafe: true, clientConfirmationCategory: "health_declaration" }),
      field("character.declarations", "Character declarations", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.criminal_charges", "Criminal charges", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.convictions", "Convictions", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.family_violence_orders", "Domestic/family violence orders", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.removals_or_deportations", "Removals / deportations", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.overstays", "Overstays", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.debts_to_australia", "Debts to the Australian Government", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.military_or_intelligence_service", "Military / intelligence service", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.weapons_training", "Weapons / explosives training", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.false_or_misleading_information", "False or misleading information", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("character.fraudulent_documents", "Fraudulent documents", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("signature.client_signature", "Signatures / declarations", { unsafe: true, clientConfirmationCategory: "document_accuracy" })
    ]
  },
  {
    key: "client_confirmations",
    title: "Client confirmations",
    description: "Structured client confirmations that must be resolved before final staff use.",
    fields: [
      field("confirmation.personal_details", "Personal details confirmation", { clientConfirmationCategory: "personal_details" }),
      field("confirmation.document_accuracy", "Document accuracy confirmation", { clientConfirmationCategory: "document_accuracy" }),
      field("confirmation.health_declaration", "Health declaration confirmation", { unsafe: true, clientConfirmationCategory: "health_declaration" }),
      field("confirmation.character_declaration", "Character declaration confirmation", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
      field("confirmation.relationship_family", "Relationship / family confirmation", { clientConfirmationCategory: "relationship_family" }),
      field("confirmation.financial_capacity", "Financial capacity confirmation", { clientConfirmationCategory: "financial_capacity" }),
      field("confirmation.employment", "Employment confirmation", { clientConfirmationCategory: "employment" }),
      field("confirmation.insurance", "Insurance confirmation", { clientConfirmationCategory: "insurance" })
    ]
  }
];

export function withCommonSections(sections: FullDraftSectionTemplate[]) {
  return [...coverSections, ...sections, familySection, ...declarationSections];
}

export function createTemplate(
  subclassCodes: string[],
  title: string,
  documentRequirements: FullDraftDocumentRequirement[],
  sections: FullDraftSectionTemplate[]
): FullApplicationDraftTemplate {
  return { subclassCodes, title, documentRequirements, sections };
}
