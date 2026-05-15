import type {
  FullApplicationDraftTemplate,
  FullDraftDocumentRequirement,
  FullDraftDocumentRequirementStatus,
  FullDraftFieldTemplate,
  FullDraftSectionTemplate,
  FullDraftSupportLevel
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
    key: "terms_application_context",
    title: "Terms and application context",
    description: "Terms, application-context and online application items are shown for staff review only. Aria does not treat these as legal conclusions.",
    fields: [
      field("terms.client_understands_online_application", "Client understands the application is prepared for online/manual entry review", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
      field("terms.information_true_correct_acknowledged", "Information true/correct acknowledgement", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
      field("terms.review_required_before_use", "Registered migration agent review required", { manualReview: true, sourceRequired: true }),
      field("application.context.current_location", "Applicant current location", { aliases: ["contact.current_location", "current_location"], sourceRequired: true, clientConfirmationCategory: "personal_details" }),
      field("application.context.application_type", "Application type / first application / renewal / subsequent entrant", { aliases: ["matter.application_type", "application_type", "application_kind"], sourceRequired: true, clientConfirmationCategory: "document_accuracy" }),
      field("application.context.online_form_state", "Official form / online-only state", { onlineOnly: true, manualReview: true })
    ]
  },
  {
    key: "application_context",
    title: "Application context",
    description: "Matter-level context used to orient the staff review draft.",
    fields: [
      field("matter.visaSubclass", "Visa subclass", { fallback: "matter", required: true }),
      field("matter.visaStream", "Stream", { fallback: "matter" }),
      field("contact.current_location", "Current location / onshore-offshore context", { aliases: ["application.context.current_location", "current_location", "location"], sourceRequired: true }),
      field("visa.current_visa_subclass", "Current visa status", { aliases: ["current_visa_subclass", "current_visa", "visa_subclass"], sourceRequired: true }),
      field("matter.stage", "Current matter stage", { fallback: "matter" }),
      field("matter.status", "Current matter status", { fallback: "matter" })
    ]
  },
  {
    key: "primary_applicant_identity",
    title: "Primary applicant identity",
    description: "Identity facts should be verified against approved passport or identity evidence.",
    fields: [
      field("applicant.full_name", "Family and given names", { aliases: ["full_name", "name", "applicant_name"], fallback: "client", required: true, sourceRequired: true }),
      field("applicant.date_of_birth", "Date of birth", { aliases: ["dob", "date_of_birth"], fallback: "client", required: true, sourceRequired: true }),
      field("applicant.sex", "Sex", { aliases: ["gender", "sex"], sourceRequired: true }),
      field("applicant.nationality", "Nationality", { aliases: ["nationality", "citizenship"], fallback: "client", required: true, sourceRequired: true }),
      field("applicant.country_of_birth", "Country of birth", { aliases: ["country_of_birth", "birth_country"], sourceRequired: true }),
      field("applicant.place_of_birth", "Place of birth", { aliases: ["place_of_birth", "birth_place"], sourceRequired: true }),
      field("applicant.passport_number", "Passport number", { aliases: ["passport_number", "passport_no"], required: true, sourceRequired: true }),
      field("applicant.passport_country", "Passport country", { aliases: ["passport_country", "passport_issuing_country"], sourceRequired: true }),
      field("applicant.passport_issue_date", "Passport issue date", { aliases: ["passport_issue_date", "passport_issued"], sourceRequired: true }),
      field("applicant.passport_expiry", "Passport expiry", { aliases: ["passport_expiry", "passport_expiry_date"], sourceRequired: true }),
      field("applicant.relationship_status", "Relationship status", { aliases: ["relationship_status", "marital_status"], clientConfirmationCategory: "relationship_family" }),
      field("applicant.aliases", "Aliases / other names", { aliases: ["aliases", "other_names"], sourceRequired: true })
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
    field("english.test_type", "Test type", { aliases: ["test_type", "english_type"], sourceRequired: true }),
    field("english.test_date", "Test date", { aliases: ["test_date", "english_test_date"], sourceRequired: true }),
    field("english.reference_number", "Reference number", { aliases: ["reference_number", "test_reference"], sourceRequired: true }),
    field("english.overall_score", "Overall score", { aliases: ["overall_score", "test_overall"], sourceRequired: true }),
    field("english.listening", "Listening", { aliases: ["listening", "listening_score"], sourceRequired: true }),
    field("english.reading", "Reading", { aliases: ["reading", "reading_score"], sourceRequired: true }),
    field("english.writing", "Writing", { aliases: ["writing", "writing_score"], sourceRequired: true }),
    field("english.speaking", "Speaking", { aliases: ["speaking", "speaking_score"], sourceRequired: true }),
    field("english.validity", "Expiry / validity", { aliases: ["validity", "expiry", "english_expiry"], sourceRequired: true }),
    field("english.score_warning", "Automated score warning for staff review", { manualReview: true, sourceRequired: true }),
    field("english.exemption", "English exemption evidence", { sourceRequired: true, clientConfirmationCategory: "document_accuracy" })
  ]
};

export const coeSection: FullDraftSectionTemplate = {
  key: "confirmation_of_enrolment",
  title: "Confirmation of Enrolment (CoE)",
  description: "Dedicated CoE details for Student visa staff review. Missing or uncertain CoE data stays source-required.",
  fields: [
    field("study.coe_number", "CoE code", { aliases: ["coe_code", "coe_number", "confirmation_of_enrolment"], sourceRequired: true }),
    field("study.provider", "Provider", { aliases: ["provider", "education_provider", "institution"], sourceRequired: true }),
    field("study.course_name", "Course", { aliases: ["course", "course_name", "program"], sourceRequired: true }),
    field("study.cricos", "CRICOS / provider code", { aliases: ["cricos", "provider_code", "cricos_code"], sourceRequired: true }),
    field("study.course_start_date", "Course start date", { aliases: ["course_start", "start_date"], sourceRequired: true }),
    field("study.course_end_date", "Course end date", { aliases: ["course_end", "end_date"], sourceRequired: true }),
    field("study.sector", "Education sector", { aliases: ["sector", "education_sector"], sourceRequired: true }),
    field("study.coe_status", "CoE status", { aliases: ["coe_status"], sourceRequired: true, clientConfirmationCategory: "document_accuracy" })
  ]
};

export const educationSection: FullDraftSectionTemplate = {
  key: "education_study",
  title: "Education / study",
  fields: [
    field("study.coe_number", "CoE code", { aliases: ["coe_code", "coe_number"], sourceRequired: true }),
    field("study.provider", "Provider / institution", { aliases: ["provider", "institution"], sourceRequired: true }),
    field("study.course_name", "Course / program", { aliases: ["course", "course_name"], sourceRequired: true }),
    field("study.cricos", "CRICOS", { aliases: ["cricos", "provider_code"], sourceRequired: true }),
    field("study.course_start_date", "Course start date", { aliases: ["course_start", "start_date"], sourceRequired: true }),
    field("study.course_end_date", "Course end date", { aliases: ["course_end", "end_date"], sourceRequired: true }),
    field("study.qualification", "Qualification", { aliases: ["qualification", "degree"], sourceRequired: true }),
    field("study.completion_date", "Completion date", { aliases: ["completion_date", "award_date"], sourceRequired: true }),
    field("study.transcripts", "Transcripts / completion evidence", { aliases: ["transcript", "transcripts", "completion_letter"], sourceRequired: true }),
    field("study.two_academic_year_requirement", "Two academic year evidence", { aliases: ["two_academic_year_requirement"], sourceRequired: true })
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

export const policeClearanceSection: FullDraftSectionTemplate = {
  key: "police_clearance_certificate",
  title: "Police clearance / PCC detected",
  description: "Police/AFP/PCC evidence is detected for staff review only. Character declarations are still never guessed.",
  fields: [
    field("police.clearance_type", "PCC / AFP type", { aliases: ["pcc_type", "afp_type", "police_clearance_type"], sourceRequired: true }),
    field("police.country", "Issuing country / jurisdiction", { aliases: ["pcc_country", "police_country"], sourceRequired: true }),
    field("police.issue_date", "Issue date", { aliases: ["pcc_issue_date", "afp_issue_date"], sourceRequired: true }),
    field("police.reference_number", "Reference number", { aliases: ["pcc_reference", "afp_reference"], sourceRequired: true }),
    field("police.result_status", "Result / disclosure status", { aliases: ["pcc_result", "afp_result"], unsafe: true, clientConfirmationCategory: "character_declaration" })
  ]
};

export const applicantDeclarationsSection: FullDraftSectionTemplate = {
  key: "applicant_declarations",
  title: "Applicant declarations",
  description: "Applicant declarations require explicit client confirmation and registered migration agent review. Aria does not infer declaration answers.",
  fields: [
    field("declaration.information_true_correct", "Information is true and correct", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
    field("declaration.notify_changes", "Applicant will notify changes", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
    field("declaration.privacy_notice", "Privacy notice / collection statement acknowledged", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
    field("declaration.biometric_collection", "Biometrics / identity collection acknowledgement", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
    field("declaration.values_statement", "Australian values statement acknowledgement", { unsafe: true, clientConfirmationCategory: "document_accuracy" }),
    field("declaration.no_false_or_misleading_info", "No false or misleading information declaration", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
    field("declaration.no_fraudulent_documents", "No fraudulent documents declaration", { unsafe: true, clientConfirmationCategory: "character_declaration" }),
    field("declaration.signature_ready", "Signature / submission declaration readiness", { unsafe: true, clientConfirmationCategory: "document_accuracy" })
  ]
};

export function withCommonSections(sections: FullDraftSectionTemplate[]) {
  return [...coverSections, ...sections, familySection, policeClearanceSection, ...declarationSections, applicantDeclarationsSection];
}

export function createTemplate(
  subclassCodes: string[],
  title: string,
  documentRequirements: FullDraftDocumentRequirement[],
  sections: FullDraftSectionTemplate[],
  supportLevel: FullDraftSupportLevel = "FULL_STAFF_DRAFT",
  supportNotes?: string
): FullApplicationDraftTemplate {
  return { subclassCodes, title, supportLevel, supportNotes, documentRequirements, sections };
}
