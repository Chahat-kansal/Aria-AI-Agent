import { TemplateValueType } from "@prisma/client";

export type VisaFieldDefinition = {
  fieldKey: string;
  label: string;
  valueType: TemplateValueType;
  required: boolean;
  supportedDocumentCategories: string[];
  sortOrder: number;
  aliases: string[];
  unsafe?: boolean;
  clientConfirmationCategory?: string;
};

export type VisaFieldSectionDefinition = {
  key: string;
  title: string;
  sortOrder: number;
  fields: VisaFieldDefinition[];
};

export type VisaRequirementDefinition = {
  category: string;
  label: string;
  description: string;
  ruleKey: string;
  required: boolean;
};

export type VisaChecklistDefinition = {
  category: string;
  label: string;
  required: boolean;
  sortOrder: number;
};

export type VisaSubclassDefinition = {
  subclassCode: string;
  stream: string;
  name: string;
  description: string;
  version: string;
  sections: VisaFieldSectionDefinition[];
  requirements: VisaRequirementDefinition[];
  checklist: VisaChecklistDefinition[];
};

function field(
  fieldKey: string,
  label: string,
  valueType: TemplateValueType,
  required: boolean,
  supportedDocumentCategories: string[],
  sortOrder: number,
  aliases: string[],
  extras?: Partial<VisaFieldDefinition>
): VisaFieldDefinition {
  return {
    fieldKey,
    label,
    valueType,
    required,
    supportedDocumentCategories,
    sortOrder,
    aliases,
    ...extras
  };
}

function applicantIdentityFields(start = 10): VisaFieldDefinition[] {
  return [
    field("applicant.full_name", "Full name", TemplateValueType.TEXT, true, ["Identity", "Travel"], start, ["full name", "name", "applicant name", "student name", "candidate name"]),
    field("applicant.date_of_birth", "Date of birth", TemplateValueType.DATE, true, ["Identity", "Travel"], start + 10, ["date of birth", "dob", "birth date"]),
    field("applicant.sex", "Sex", TemplateValueType.TEXT, false, ["Identity"], start + 20, ["sex", "gender"]),
    field("applicant.nationality", "Nationality", TemplateValueType.TEXT, true, ["Identity", "Travel"], start + 30, ["nationality", "citizenship"]),
    field("applicant.passport_number", "Passport number", TemplateValueType.TEXT, true, ["Identity", "Travel"], start + 40, ["passport number", "passport no", "passport"]),
    field("applicant.passport_country", "Passport country", TemplateValueType.TEXT, false, ["Identity", "Travel"], start + 50, ["passport country", "issuing country", "country of issue"]),
    field("applicant.passport_issue_date", "Passport issue date", TemplateValueType.DATE, false, ["Identity", "Travel"], start + 60, ["passport issue date", "date of issue"]),
    field("applicant.passport_expiry", "Passport expiry", TemplateValueType.DATE, false, ["Identity", "Travel"], start + 70, ["passport expiry", "expiry date", "date of expiry"]),
    field("applicant.country_of_birth", "Country of birth", TemplateValueType.TEXT, false, ["Identity"], start + 80, ["country of birth"]),
    field("applicant.place_of_birth", "Place of birth", TemplateValueType.TEXT, false, ["Identity"], start + 90, ["place of birth", "city of birth"])
  ];
}

function contactFields(start = 10): VisaFieldDefinition[] {
  return [
    field("contact.current_location", "Current location", TemplateValueType.TEXT, false, ["Travel", "Other Evidence"], start, ["current location", "country currently in", "location"]),
    field("contact.residential_address", "Residential address", TemplateValueType.TEXT, false, ["Identity", "Other Evidence"], start + 10, ["residential address", "address", "home address"]),
    field("contact.phone", "Phone", TemplateValueType.TEXT, false, ["Other Evidence"], start + 20, ["phone", "mobile", "telephone"]),
    field("contact.email", "Email", TemplateValueType.TEXT, false, ["Other Evidence"], start + 30, ["email", "email address"])
  ];
}

function declarationFields(start = 10): VisaFieldDefinition[] {
  return [
    field("health.declarations", "Health declarations", TemplateValueType.TEXT, true, ["Health / Insurance", "Statements / Declarations"], start, ["health declaration", "health answers"], {
      unsafe: true,
      clientConfirmationCategory: "health_declaration"
    }),
    field("character.declarations", "Character declarations", TemplateValueType.TEXT, true, ["Health / Insurance", "Statements / Declarations"], start + 10, ["character declaration", "character answers", "criminal history"], {
      unsafe: true,
      clientConfirmationCategory: "character_declaration"
    }),
    field("signature.client_signature", "Client signature", TemplateValueType.TEXT, false, ["Forms", "Statements / Declarations"], start + 20, ["signature", "client signature"], {
      unsafe: true
    })
  ];
}

function relationshipFields(prefix = "relationship", start = 10): VisaFieldDefinition[] {
  return [
    field(`${prefix}.start_date`, "Relationship start date", TemplateValueType.DATE, true, ["Relationship", "Statements / Declarations"], start, ["relationship start date", "relationship commenced", "started relationship"]),
    field(`${prefix}.marriage_or_defacto_date`, "Marriage / de facto date", TemplateValueType.DATE, false, ["Relationship"], start + 10, ["marriage date", "de facto date", "married on"]),
    field(`${prefix}.cohabitation`, "Living together evidence", TemplateValueType.TEXT, true, ["Relationship"], start + 20, ["living together", "cohabitation", "lived together"]),
    field(`${prefix}.financial_evidence`, "Financial evidence", TemplateValueType.TEXT, true, ["Relationship", "Financial"], start + 30, ["joint finances", "financial evidence", "shared finances"]),
    field(`${prefix}.household_evidence`, "Household evidence", TemplateValueType.TEXT, true, ["Relationship"], start + 40, ["household evidence", "shared household"]),
    field(`${prefix}.social_evidence`, "Social evidence", TemplateValueType.TEXT, true, ["Relationship"], start + 50, ["social evidence", "social recognition"]),
    field(`${prefix}.commitment_evidence`, "Commitment evidence", TemplateValueType.TEXT, true, ["Relationship"], start + 60, ["commitment evidence", "ongoing commitment"]),
    field(`${prefix}.timeline`, "Relationship timeline", TemplateValueType.TEXT, true, ["Relationship", "Statements / Declarations"], start + 70, ["relationship timeline", "relationship history", "timeline"]),
    field(`${prefix}.separation_periods`, "Separation periods", TemplateValueType.TEXT, false, ["Relationship", "Statements / Declarations"], start + 80, ["separation period", "periods apart"]),
    field(`${prefix}.future_plans`, "Future plans", TemplateValueType.TEXT, false, ["Statements / Declarations"], start + 90, ["future plans", "plans together"], {
      unsafe: true,
      clientConfirmationCategory: "relationship_family"
    })
  ];
}

function skilledPointsFields(start = 10): VisaFieldDefinition[] {
  return [
    field("points.age", "Age points", TemplateValueType.NUMBER, true, ["Identity"], start, ["age points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.english", "English points", TemplateValueType.NUMBER, true, ["Education"], start + 10, ["english points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.overseas_employment", "Overseas employment points", TemplateValueType.NUMBER, false, ["Employment"], start + 20, ["overseas employment points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.australian_employment", "Australian employment points", TemplateValueType.NUMBER, false, ["Employment"], start + 30, ["australian employment points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.australian_study", "Australian study points", TemplateValueType.NUMBER, false, ["Education"], start + 40, ["australian study points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.specialist_education", "Specialist education points", TemplateValueType.NUMBER, false, ["Education"], start + 50, ["specialist education points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.partner", "Partner points", TemplateValueType.NUMBER, false, ["Relationship", "Education"], start + 60, ["partner points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.naati", "NAATI / community language points", TemplateValueType.NUMBER, false, ["Education"], start + 70, ["naati points", "community language points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.professional_year", "Professional year points", TemplateValueType.NUMBER, false, ["Education"], start + 80, ["professional year points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.nomination", "Nomination / regional points", TemplateValueType.NUMBER, false, ["Forms", "Employment"], start + 90, ["nomination points", "regional points"], { clientConfirmationCategory: "skilled_points" }),
    field("points.total", "Total points", TemplateValueType.NUMBER, true, ["Forms", "Education", "Employment"], start + 100, ["total points"], { clientConfirmationCategory: "skilled_points" })
  ];
}

const defs: Record<string, VisaSubclassDefinition> = {
  "500": {
    subclassCode: "500",
    stream: "Higher Education",
    name: "Student visa (Subclass 500)",
    description: "AI-assisted draft application template for Subclass 500 student visa matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: applicantIdentityFields() },
      { key: "contact", title: "Contact details", sortOrder: 15, fields: contactFields() },
      {
        key: "study",
        title: "Study details",
        sortOrder: 20,
        fields: [
          field("study.provider", "Education provider", TemplateValueType.TEXT, true, ["Education"], 10, ["provider", "institution", "provider name", "university", "college"]),
          field("study.course_name", "Course name", TemplateValueType.TEXT, true, ["Education"], 20, ["course name", "course", "program", "qualification"]),
          field("study.coe_number", "CoE number", TemplateValueType.TEXT, true, ["Education"], 30, ["coe number", "confirmation of enrolment number", "coe"]),
          field("study.cricos", "CRICOS", TemplateValueType.TEXT, false, ["Education"], 40, ["cricos", "cricos code"]),
          field("study.course_start_date", "Course start date", TemplateValueType.DATE, true, ["Education"], 50, ["course start", "start date", "commencement"]),
          field("study.course_end_date", "Course end date", TemplateValueType.DATE, false, ["Education"], 60, ["course end", "end date", "completion date"])
        ]
      },
      {
        key: "evidence",
        title: "Evidence and declarations",
        sortOrder: 30,
        fields: [
          field("financial.available_funds", "Available funds", TemplateValueType.CURRENCY, true, ["Financial"], 10, ["available funds", "funds", "balance", "declared funds"], {
            clientConfirmationCategory: "financial_capacity"
          }),
          field("health.oshc_provider", "OSHC provider", TemplateValueType.TEXT, true, ["Health / Insurance"], 20, ["oshc provider", "health insurance provider", "oshc", "health insurance"]),
          field("statement.genuine_student", "Genuine student statement present", TemplateValueType.BOOLEAN, true, ["Statements / Declarations"], 30, ["genuine student", "genuine temporary entrant", "statement"], {
            unsafe: true,
            clientConfirmationCategory: "study_gte"
          }),
          ...declarationFields(40)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport identity page", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Education", label: "Confirmation of Enrolment", description: "CoE or equivalent enrolment evidence for the intended course.", ruleKey: "education.coe", required: true },
      { category: "Financial", label: "Financial capacity evidence", description: "Evidence supporting access to funds.", ruleKey: "financial.capacity", required: true },
      { category: "Health / Insurance", label: "OSHC evidence", description: "Health insurance evidence covering the required period.", ruleKey: "health.oshc", required: true },
      { category: "Statements / Declarations", label: "Genuine student statement", description: "Current statement/declaration requiring agent review.", ruleKey: "statement.genuine_student", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity fields verified against passport", required: true, sortOrder: 10 },
      { category: "Education", label: "CoE details reviewed and source-linked", required: true, sortOrder: 20 },
      { category: "Financial", label: "Financial capacity evidence reviewed", required: true, sortOrder: 30 },
      { category: "Health / Insurance", label: "OSHC coverage evidence reviewed", required: true, sortOrder: 40 },
      { category: "Client review", label: "Draft sent for client confirmation/sign-off", required: true, sortOrder: 50 }
    ]
  },
  "485": {
    subclassCode: "485",
    stream: "Graduate",
    name: "Temporary Graduate visa (Subclass 485)",
    description: "Field-level draft autofill template for Subclass 485 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: applicantIdentityFields() },
      { key: "contact", title: "Contact details", sortOrder: 15, fields: contactFields() },
      {
        key: "visa",
        title: "Current visa context",
        sortOrder: 20,
        fields: [
          field("visa.current_visa_subclass", "Current visa subclass", TemplateValueType.TEXT, true, ["Travel"], 10, ["current visa subclass", "current visa", "visa subclass"]),
          field("visa.grant_number", "Visa grant number", TemplateValueType.TEXT, true, ["Travel"], 20, ["grant number", "visa grant number"]),
          field("visa.grant_date", "Visa grant date", TemplateValueType.DATE, false, ["Travel"], 30, ["grant date", "visa grant date"]),
          field("visa.expiry_date", "Visa expiry", TemplateValueType.DATE, true, ["Travel"], 40, ["visa expiry", "expiry date"]),
          field("visa.primary_holder", "Primary visa holder", TemplateValueType.TEXT, false, ["Relationship", "Travel"], 50, ["primary visa holder", "main applicant"]),
          field("visa.relationship_to_primary", "Relationship to primary holder", TemplateValueType.TEXT, false, ["Relationship"], 60, ["relationship to primary holder", "relationship to primary applicant"])
        ]
      },
      {
        key: "study",
        title: "Study / qualification",
        sortOrder: 30,
        fields: [
          field("study.qualification", "Australian qualification", TemplateValueType.TEXT, true, ["Education"], 10, ["qualification", "award", "degree"]),
          field("study.provider", "Institution / provider", TemplateValueType.TEXT, true, ["Education"], 20, ["provider", "institution", "education provider"]),
          field("study.provider_code", "Provider / CRICOS code", TemplateValueType.TEXT, false, ["Education"], 30, ["cricos", "provider code"]),
          field("study.completion_date", "Completion date", TemplateValueType.DATE, true, ["Education"], 40, ["completion date", "course completion", "award date"]),
          field("study.course_start_date", "Course start date", TemplateValueType.DATE, true, ["Education"], 50, ["course start", "start date"]),
          field("study.course_end_date", "Course end date", TemplateValueType.DATE, true, ["Education"], 60, ["course end", "end date"]),
          field("study.two_academic_year_requirement", "Two academic year requirement evidence", TemplateValueType.TEXT, false, ["Education"], 70, ["two academic year requirement", "92 weeks", "academic year requirement"])
        ]
      },
      {
        key: "english",
        title: "English / checks / insurance",
        sortOrder: 40,
        fields: [
          field("english.test_type", "English test type", TemplateValueType.TEXT, true, ["Education"], 10, ["test type", "ielts", "pte", "toefl", "oet"]),
          field("english.test_date", "English test date", TemplateValueType.DATE, true, ["Education"], 20, ["test date"]),
          field("english.overall_score", "Overall score", TemplateValueType.TEXT, true, ["Education"], 30, ["overall score", "overall"]),
          field("english.reference_number", "Reference number", TemplateValueType.TEXT, false, ["Education"], 40, ["reference number", "report number", "registration number"]),
          field("english.validity", "English validity / expiry", TemplateValueType.DATE, false, ["Education"], 50, ["validity date", "expiry date"]),
          field("skills.assessment", "Skills assessment", TemplateValueType.TEXT, false, ["Employment", "Education"], 60, ["skills assessment", "assessment outcome"]),
          field("character.afp_status", "AFP check status", TemplateValueType.TEXT, false, ["Health / Insurance"], 70, ["afp check", "afp status", "police clearance"]),
          field("health.oshc_provider", "Health insurance provider", TemplateValueType.TEXT, true, ["Health / Insurance"], 80, ["ovhc provider", "health insurance provider", "oshc provider", "insurance provider"]),
          field("health.policy_number", "Policy number", TemplateValueType.TEXT, false, ["Health / Insurance"], 90, ["policy number"]),
          field("health.cover_start", "Cover start", TemplateValueType.DATE, false, ["Health / Insurance"], 100, ["cover start", "policy start", "start date"]),
          field("health.cover_end", "Cover end", TemplateValueType.DATE, false, ["Health / Insurance"], 110, ["cover end", "policy end", "end date"]),
          ...declarationFields(120)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Travel", label: "Current visa evidence", description: "Grant notice, VEVO, or current visa evidence.", ruleKey: "travel.current_visa", required: true },
      { category: "Education", label: "Completion evidence", description: "Completion letter, transcript, or award evidence.", ruleKey: "education.completion", required: true },
      { category: "Education", label: "English evidence", description: "English test or exemption evidence where relevant.", ruleKey: "education.english", required: true },
      { category: "Health / Insurance", label: "Insurance / AFP evidence", description: "Insurance evidence and AFP/police evidence where required.", ruleKey: "health.insurance_afp", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity and passport fields reviewed", required: true, sortOrder: 10 },
      { category: "Travel", label: "Current visa grant details reviewed", required: true, sortOrder: 20 },
      { category: "Education", label: "Qualification and completion evidence reviewed", required: true, sortOrder: 30 },
      { category: "Education", label: "English evidence reviewed", required: true, sortOrder: 40 },
      { category: "Health / Insurance", label: "AFP and health insurance reviewed", required: true, sortOrder: 50 }
    ]
  },
  "482": {
    subclassCode: "482",
    stream: "Skills in Demand",
    name: "Skills in Demand / TSS (Subclass 482)",
    description: "Field-level draft autofill template for Subclass 482 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: applicantIdentityFields() },
      { key: "contact", title: "Contact details", sortOrder: 15, fields: contactFields() },
      {
        key: "employment",
        title: "Occupation and employment",
        sortOrder: 20,
        fields: [
          field("employment.nominated_occupation", "Nominated occupation", TemplateValueType.TEXT, true, ["Employment"], 10, ["nominated occupation", "occupation"]),
          field("employment.anzsco", "ANZSCO", TemplateValueType.TEXT, false, ["Employment"], 20, ["anzsco"]),
          field("employment.employer_name", "Employer / sponsor", TemplateValueType.TEXT, true, ["Employment", "Forms"], 30, ["employer", "sponsor business name", "business name"]),
          field("employment.position_title", "Position title", TemplateValueType.TEXT, true, ["Employment"], 40, ["position title", "job title"]),
          field("employment.salary", "Salary", TemplateValueType.CURRENCY, true, ["Employment"], 50, ["salary", "annual salary", "annual earnings"]),
          field("employment.work_location", "Work location", TemplateValueType.TEXT, false, ["Employment"], 60, ["work location", "location"]),
          field("employment.duties", "Duties", TemplateValueType.TEXT, false, ["Employment"], 70, ["duties", "responsibilities"]),
          field("employment.contract_details", "Contract details", TemplateValueType.TEXT, true, ["Employment"], 80, ["employment contract", "contract details"]),
          field("employment.history", "Employment history", TemplateValueType.TEXT, true, ["Employment"], 90, ["employment history", "work history"]),
          field("employment.references", "Employment references", TemplateValueType.TEXT, true, ["Employment"], 100, ["employment reference", "reference letter"])
        ]
      },
      {
        key: "sponsor",
        title: "Sponsor / nomination",
        sortOrder: 30,
        fields: [
          field("sponsor.business_name", "Sponsor business name", TemplateValueType.TEXT, true, ["Employment", "Forms"], 10, ["sponsor business name", "business name", "employer"]),
          field("sponsor.abn", "ABN / ACN", TemplateValueType.TEXT, false, ["Employment", "Forms"], 20, ["abn", "acn"]),
          field("sponsor.nomination_details", "Nomination details", TemplateValueType.TEXT, true, ["Forms", "Employment"], 30, ["nomination details", "nomination"]),
          field("sponsor.labour_market_testing", "Labour market testing evidence", TemplateValueType.TEXT, false, ["Employment"], 40, ["labour market testing", "lmt"]),
          field("sponsor.market_rate", "Salary market rate evidence", TemplateValueType.TEXT, false, ["Employment"], 50, ["market salary rate", "market rate"]),
          field("sponsor.occupation_notes", "Occupation caveats / notes", TemplateValueType.TEXT, false, ["Employment"], 60, ["occupation caveat", "occupation note"])
        ]
      },
      {
        key: "supporting",
        title: "Skills, English, family, declarations",
        sortOrder: 40,
        fields: [
          field("skills.assessment", "Skills assessment", TemplateValueType.TEXT, false, ["Employment", "Education"], 10, ["skills assessment", "assessment outcome"]),
          field("english.test_type", "English test type", TemplateValueType.TEXT, false, ["Education"], 20, ["test type", "ielts", "pte", "toefl", "oet"]),
          field("english.test_date", "English test date", TemplateValueType.DATE, false, ["Education"], 30, ["test date"]),
          field("english.overall_score", "English overall score", TemplateValueType.TEXT, false, ["Education"], 40, ["overall score", "overall"]),
          field("english.exemption", "English exemption evidence", TemplateValueType.TEXT, false, ["Education", "Identity"], 50, ["english exemption", "exempt"]),
          field("family.partner_name", "Partner / dependant details", TemplateValueType.TEXT, false, ["Relationship", "Identity"], 60, ["partner", "dependant", "spouse"]),
          field("relationship.evidence", "Relationship evidence", TemplateValueType.TEXT, false, ["Relationship"], 70, ["relationship evidence", "marriage certificate"]),
          ...declarationFields(80)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Employment", label: "Employment and contract evidence", description: "Occupation, contract, references, and work history evidence.", ruleKey: "employment.contract", required: true },
      { category: "Forms", label: "Nomination / sponsor evidence", description: "Nomination and sponsor support evidence.", ruleKey: "sponsor.nomination", required: true },
      { category: "Education", label: "English evidence where relevant", description: "English test or exemption evidence.", ruleKey: "education.english", required: false }
    ],
    checklist: [
      { category: "Identity", label: "Identity details reviewed against passport", required: true, sortOrder: 10 },
      { category: "Employment", label: "Occupation, contract, salary, and duties reviewed", required: true, sortOrder: 20 },
      { category: "Forms", label: "Sponsor / nomination evidence reviewed", required: true, sortOrder: 30 },
      { category: "Employment", label: "References and work history reviewed", required: true, sortOrder: 40 },
      { category: "Client review", label: "Declarations and family details confirmed", required: true, sortOrder: 50 }
    ]
  },
  "186": {
    subclassCode: "186",
    stream: "ENS",
    name: "Employer Nomination Scheme (Subclass 186)",
    description: "Field-level draft autofill template for Subclass 186 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: applicantIdentityFields() },
      { key: "contact", title: "Contact details", sortOrder: 15, fields: contactFields() },
      {
        key: "visa_employment",
        title: "Visa and employment",
        sortOrder: 20,
        fields: [
          field("visa.current_visa_subclass", "Current visa status", TemplateValueType.TEXT, false, ["Travel"], 10, ["current visa", "visa subclass"]),
          field("applicant.age", "Age", TemplateValueType.NUMBER, false, ["Identity"], 20, ["age"]),
          field("employment.nominated_occupation", "Occupation", TemplateValueType.TEXT, true, ["Employment"], 30, ["occupation", "nominated occupation"]),
          field("employment.anzsco", "ANZSCO", TemplateValueType.TEXT, false, ["Employment"], 40, ["anzsco"]),
          field("employment.employer_name", "Employer / sponsor", TemplateValueType.TEXT, true, ["Employment", "Forms"], 50, ["employer", "sponsor business name", "business name"]),
          field("employment.position_title", "Position", TemplateValueType.TEXT, true, ["Employment"], 60, ["position title", "job title"]),
          field("employment.work_location", "Work location", TemplateValueType.TEXT, false, ["Employment"], 70, ["work location"]),
          field("employment.salary", "Salary", TemplateValueType.CURRENCY, true, ["Employment"], 80, ["salary", "annual salary"]),
          field("employment.contract_details", "Employment contract", TemplateValueType.TEXT, true, ["Employment"], 90, ["employment contract", "contract"]),
          field("employment.years_with_employer", "Years with employer", TemplateValueType.TEXT, false, ["Employment"], 100, ["years with employer", "length of service"])
        ]
      },
      {
        key: "nomination_support",
        title: "Nomination, skills, English",
        sortOrder: 30,
        fields: [
          field("sponsor.abn", "ABN / ACN", TemplateValueType.TEXT, false, ["Employment", "Forms"], 10, ["abn", "acn"]),
          field("sponsor.nomination_details", "Nomination details", TemplateValueType.TEXT, true, ["Forms", "Employment"], 20, ["nomination details", "nomination"]),
          field("sponsor.stream", "TRT / direct entry stream", TemplateValueType.TEXT, false, ["Forms"], 30, ["trt stream", "direct entry", "stream"]),
          field("skills.assessment", "Skills assessment", TemplateValueType.TEXT, false, ["Employment", "Education"], 40, ["skills assessment", "assessment outcome"]),
          field("study.qualification", "Qualifications", TemplateValueType.TEXT, false, ["Education"], 50, ["qualification", "degree", "diploma"]),
          field("employment.history", "Employment history", TemplateValueType.TEXT, true, ["Employment"], 60, ["employment history", "work history"]),
          field("english.test_type", "English test type", TemplateValueType.TEXT, false, ["Education"], 70, ["test type", "ielts", "pte", "toefl", "oet"]),
          field("english.overall_score", "English overall score", TemplateValueType.TEXT, false, ["Education"], 80, ["overall score", "overall"]),
          field("english.exemption", "English exemption evidence", TemplateValueType.TEXT, false, ["Education", "Identity"], 90, ["english exemption", "exempt"]),
          ...declarationFields(100)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Employment", label: "Employer and contract evidence", description: "Employment contract, salary, and role details.", ruleKey: "employment.contract", required: true },
      { category: "Forms", label: "Nomination evidence", description: "Nomination evidence and stream support.", ruleKey: "sponsor.nomination", required: true },
      { category: "Employment", label: "Skills / employment history", description: "Skills and work history evidence.", ruleKey: "employment.skills", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity and passport fields reviewed", required: true, sortOrder: 10 },
      { category: "Employment", label: "Employer, occupation, contract, and salary reviewed", required: true, sortOrder: 20 },
      { category: "Forms", label: "Nomination and stream evidence reviewed", required: true, sortOrder: 30 },
      { category: "Employment", label: "Skills and employment history reviewed", required: true, sortOrder: 40 }
    ]
  },
  "820/801": {
    subclassCode: "820/801",
    stream: "Partner",
    name: "Partner visa (Subclass 820/801)",
    description: "Field-level draft autofill template for Subclass 820/801 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: [...applicantIdentityFields(), ...contactFields(110), field("applicant.relationship_status", "Relationship status", TemplateValueType.TEXT, false, ["Relationship"], 150, ["relationship status"])] },
      {
        key: "sponsor",
        title: "Sponsor details",
        sortOrder: 20,
        fields: [
          field("sponsor.full_name", "Sponsor name", TemplateValueType.TEXT, true, ["Relationship", "Identity"], 10, ["sponsor name", "partner name"]),
          field("sponsor.date_of_birth", "Sponsor DOB", TemplateValueType.DATE, false, ["Identity"], 20, ["sponsor date of birth", "partner dob"]),
          field("sponsor.status", "Citizenship / PR status", TemplateValueType.TEXT, true, ["Identity", "Relationship"], 30, ["citizenship status", "permanent resident status", "sponsor status"]),
          field("sponsor.identity_evidence", "Sponsor identity evidence", TemplateValueType.TEXT, true, ["Identity"], 40, ["citizenship certificate", "australian passport", "sponsor identity"]),
          field("sponsor.address", "Sponsor address", TemplateValueType.TEXT, false, ["Relationship", "Identity"], 50, ["sponsor address", "partner address"]),
          field("sponsor.contact", "Sponsor contact", TemplateValueType.TEXT, false, ["Relationship", "Identity"], 60, ["sponsor contact", "partner contact"])
        ]
      },
      {
        key: "relationship",
        title: "Relationship evidence",
        sortOrder: 30,
        fields: [
          ...relationshipFields("relationship", 10),
          field("relationship.previous_relationships", "Previous relationships", TemplateValueType.TEXT, false, ["Statements / Declarations"], 110, ["previous relationships"], {
            unsafe: true,
            clientConfirmationCategory: "relationship_family"
          })
        ]
      },
      {
        key: "witness",
        title: "Witness / support / declarations",
        sortOrder: 40,
        fields: [
          field("relationship.form_888", "Form 888 / witness support", TemplateValueType.TEXT, false, ["Relationship"], 10, ["form 888", "witness statement", "supporting witness"]),
          field("relationship.family_friend_evidence", "Family / friend evidence", TemplateValueType.TEXT, false, ["Relationship"], 20, ["family evidence", "friend evidence"]),
          ...declarationFields(30)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Applicant and sponsor identity evidence", description: "Passport and sponsor status evidence.", ruleKey: "identity.partner", required: true },
      { category: "Relationship", label: "Relationship evidence", description: "Relationship categories must be supported by evidence.", ruleKey: "relationship.evidence", required: true },
      { category: "Statements / Declarations", label: "Relationship timeline statements", description: "Timeline and explanation statements requiring review.", ruleKey: "relationship.timeline", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Applicant and sponsor identity reviewed", required: true, sortOrder: 10 },
      { category: "Relationship", label: "Financial, household, social, and commitment evidence reviewed", required: true, sortOrder: 20 },
      { category: "Relationship", label: "Timeline and cohabitation evidence reviewed", required: true, sortOrder: 30 },
      { category: "Client review", label: "Declarations and relationship confirmations reviewed", required: true, sortOrder: 40 }
    ]
  },
  "309/100": {
    subclassCode: "309/100",
    stream: "Partner Offshore",
    name: "Partner visa (Subclass 309/100)",
    description: "Field-level draft autofill template for Subclass 309/100 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: [...applicantIdentityFields(), ...contactFields(110)] },
      {
        key: "sponsor",
        title: "Sponsor details",
        sortOrder: 20,
        fields: [
          field("sponsor.full_name", "Sponsor name", TemplateValueType.TEXT, true, ["Relationship", "Identity"], 10, ["sponsor name", "partner name"]),
          field("sponsor.status", "Citizenship / PR status", TemplateValueType.TEXT, true, ["Identity", "Relationship"], 20, ["citizenship status", "permanent resident status", "sponsor status"]),
          field("sponsor.identity_evidence", "Sponsor identity evidence", TemplateValueType.TEXT, true, ["Identity"], 30, ["citizenship certificate", "australian passport", "sponsor identity"])
        ]
      },
      {
        key: "relationship",
        title: "Offshore relationship evidence",
        sortOrder: 30,
        fields: [
          ...relationshipFields("relationship", 10),
          field("relationship.communication_history", "Communication history", TemplateValueType.TEXT, true, ["Relationship"], 110, ["communication history", "messages", "call logs"]),
          field("relationship.travel_visits", "Travel / visits", TemplateValueType.TEXT, false, ["Travel", "Relationship"], 120, ["travel history", "visits", "travel / visits"]),
          field("relationship.financial_support", "Financial support", TemplateValueType.TEXT, false, ["Relationship", "Financial"], 130, ["financial support", "money transfers"])
        ]
      },
      {
        key: "supporting",
        title: "Witnesses / declarations",
        sortOrder: 40,
        fields: [
          field("relationship.form_888", "Form 888 / witness support", TemplateValueType.TEXT, false, ["Relationship"], 10, ["form 888", "witness statement", "supporting witness"]),
          ...declarationFields(20)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Applicant and sponsor identity evidence", description: "Passport and sponsor status evidence.", ruleKey: "identity.partner", required: true },
      { category: "Relationship", label: "Relationship evidence", description: "Offshore relationship evidence categories must be supported.", ruleKey: "relationship.evidence", required: true },
      { category: "Travel", label: "Travel / visit evidence", description: "Travel and visit evidence where relied on.", ruleKey: "relationship.travel", required: false }
    ],
    checklist: [
      { category: "Identity", label: "Applicant and sponsor identity reviewed", required: true, sortOrder: 10 },
      { category: "Relationship", label: "Relationship categories and communication evidence reviewed", required: true, sortOrder: 20 },
      { category: "Travel", label: "Travel and visit evidence reviewed", required: false, sortOrder: 30 },
      { category: "Client review", label: "Relationship declarations reviewed", required: true, sortOrder: 40 }
    ]
  },
  "189": {
    subclassCode: "189",
    stream: "Skilled Independent",
    name: "Skilled Independent visa (Subclass 189)",
    description: "Field-level draft autofill template for Subclass 189 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: [...applicantIdentityFields(), ...contactFields(110)] },
      {
        key: "skills",
        title: "EOI / skills / invitation",
        sortOrder: 20,
        fields: [
          field("skills.occupation", "Occupation", TemplateValueType.TEXT, true, ["Employment", "Education"], 10, ["occupation", "nominated occupation"]),
          field("skills.anzsco", "ANZSCO", TemplateValueType.TEXT, true, ["Employment", "Education"], 20, ["anzsco"]),
          field("skills.assessing_authority", "Assessing authority", TemplateValueType.TEXT, true, ["Employment", "Education"], 30, ["assessing authority"]),
          field("skills.assessment_reference", "Skills assessment reference", TemplateValueType.TEXT, true, ["Employment", "Education"], 40, ["skills assessment reference", "assessment reference"]),
          field("skills.assessment_date", "Skills assessment date", TemplateValueType.DATE, true, ["Employment", "Education"], 50, ["skills assessment date", "assessment date"]),
          field("skills.assessment_outcome", "Skills assessment outcome", TemplateValueType.TEXT, true, ["Employment", "Education"], 60, ["skills assessment outcome", "assessment outcome"]),
          field("skills.invitation_reference", "Invitation reference", TemplateValueType.TEXT, false, ["Forms"], 70, ["invitation reference", "invite reference"])
        ]
      },
      {
        key: "points",
        title: "Points claims",
        sortOrder: 30,
        fields: [
          ...skilledPointsFields(10),
          field("employment.references", "Employment references", TemplateValueType.TEXT, true, ["Employment"], 120, ["employment references", "reference letters"]),
          field("employment.payslips_tax_super", "Payslip / tax / super evidence", TemplateValueType.TEXT, false, ["Employment", "Financial"], 130, ["payslip", "tax", "super"]),
          field("study.transcripts", "Qualification transcripts", TemplateValueType.TEXT, false, ["Education"], 140, ["transcript", "completion letter"]),
          ...declarationFields(150)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Employment", label: "Skills assessment and employment evidence", description: "Skills assessment plus work evidence for claimed points.", ruleKey: "skills.assessment", required: true },
      { category: "Education", label: "English evidence", description: "English test evidence for points claims.", ruleKey: "points.english", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity details reviewed", required: true, sortOrder: 10 },
      { category: "Employment", label: "Occupation and skills assessment reviewed", required: true, sortOrder: 20 },
      { category: "Points", label: "Points claims reviewed against evidence", required: true, sortOrder: 30 },
      { category: "Client review", label: "Declarations and points confirmations reviewed", required: true, sortOrder: 40 }
    ]
  },
  "190": {
    subclassCode: "190",
    stream: "Skilled Nominated",
    name: "Skilled Nominated visa (Subclass 190)",
    description: "Field-level draft autofill template for Subclass 190 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      {
        key: "nomination",
        title: "Nomination details",
        sortOrder: 40,
        fields: [
          field("nomination.state", "State / territory nomination", TemplateValueType.TEXT, true, ["Forms"], 10, ["state nomination", "territory nomination"]),
          field("nomination.reference", "Nomination reference", TemplateValueType.TEXT, false, ["Forms"], 20, ["nomination reference", "invitation reference"])
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Employment", label: "Skills assessment and employment evidence", description: "Skills assessment plus work evidence for claimed points.", ruleKey: "skills.assessment", required: true },
      { category: "Education", label: "English evidence", description: "English test evidence for points claims.", ruleKey: "points.english", required: true },
      { category: "Forms", label: "State nomination evidence", description: "State or territory nomination evidence.", ruleKey: "nomination.state", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity details reviewed", required: true, sortOrder: 10 },
      { category: "Employment", label: "Occupation and skills assessment reviewed", required: true, sortOrder: 20 },
      { category: "Points", label: "Points claims reviewed against evidence", required: true, sortOrder: 30 },
      { category: "Forms", label: "State nomination reviewed", required: true, sortOrder: 40 }
    ]
  },
  "491": {
    subclassCode: "491",
    stream: "Regional Skilled",
    name: "Skilled Work Regional visa (Subclass 491)",
    description: "Field-level draft autofill template for Subclass 491 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      {
        key: "nomination",
        title: "Regional nomination / sponsor",
        sortOrder: 40,
        fields: [
          field("nomination.state", "State / territory nomination", TemplateValueType.TEXT, false, ["Forms"], 10, ["state nomination", "territory nomination"]),
          field("nomination.reference", "Nomination / sponsor reference", TemplateValueType.TEXT, false, ["Forms", "Relationship"], 20, ["nomination reference", "sponsor reference"]),
          field("nomination.regional_support", "Regional nomination / sponsor evidence", TemplateValueType.TEXT, true, ["Forms", "Relationship"], 30, ["regional nomination", "eligible relative sponsor", "regional support"])
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Employment", label: "Skills assessment and employment evidence", description: "Skills assessment plus work evidence for claimed points.", ruleKey: "skills.assessment", required: true },
      { category: "Education", label: "English evidence", description: "English test evidence for points claims.", ruleKey: "points.english", required: true },
      { category: "Forms", label: "Regional nomination / sponsor evidence", description: "Regional nomination or sponsor evidence.", ruleKey: "nomination.regional", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity details reviewed", required: true, sortOrder: 10 },
      { category: "Employment", label: "Occupation and skills assessment reviewed", required: true, sortOrder: 20 },
      { category: "Points", label: "Points claims reviewed against evidence", required: true, sortOrder: 30 },
      { category: "Forms", label: "Regional nomination / sponsor evidence reviewed", required: true, sortOrder: 40 }
    ]
  },
  "600": {
    subclassCode: "600",
    stream: "Visitor",
    name: "Visitor visa (Subclass 600)",
    description: "Field-level draft autofill template for Subclass 600 matter preparation. Review required.",
    version: "2026.05",
    sections: [
      { key: "applicant", title: "Applicant details", sortOrder: 10, fields: [...applicantIdentityFields(), ...contactFields(110)] },
      {
        key: "travel",
        title: "Travel purpose and itinerary",
        sortOrder: 20,
        fields: [
          field("travel.arrival_date", "Intended arrival", TemplateValueType.DATE, false, ["Travel"], 10, ["arrival date", "intended arrival"]),
          field("travel.departure_date", "Intended departure", TemplateValueType.DATE, false, ["Travel"], 20, ["departure date", "intended departure"]),
          field("travel.purpose", "Purpose of visit", TemplateValueType.TEXT, true, ["Travel", "Statements / Declarations"], 30, ["purpose of visit", "visit purpose"], {
            clientConfirmationCategory: "visitor_travel"
          }),
          field("travel.itinerary", "Itinerary", TemplateValueType.TEXT, true, ["Travel"], 40, ["itinerary", "travel itinerary"]),
          field("travel.invitation_letter", "Invitation letter", TemplateValueType.TEXT, false, ["Travel", "Relationship"], 50, ["invitation letter"]),
          field("travel.accommodation", "Accommodation", TemplateValueType.TEXT, false, ["Travel", "Relationship"], 60, ["accommodation"]),
          field("travel.australia_contact", "Australian family/friend details", TemplateValueType.TEXT, false, ["Relationship"], 70, ["family in australia", "friend in australia", "host details"])
        ]
      },
      {
        key: "financial",
        title: "Financial and home ties",
        sortOrder: 30,
        fields: [
          field("financial.available_funds", "Funds available", TemplateValueType.CURRENCY, true, ["Financial"], 10, ["available funds", "funds", "balance", "declared funds"], {
            clientConfirmationCategory: "financial_capacity"
          }),
          field("financial.source_of_funds", "Source of funds", TemplateValueType.TEXT, false, ["Financial"], 20, ["source of funds", "funding source"], {
            clientConfirmationCategory: "financial_capacity"
          }),
          field("financial.sponsor_support", "Sponsor support", TemplateValueType.TEXT, false, ["Financial", "Relationship"], 30, ["sponsor support", "financial sponsor"]),
          field("ties.employment", "Employment ties", TemplateValueType.TEXT, false, ["Employment"], 40, ["employment evidence", "employment ties"], {
            clientConfirmationCategory: "visitor_travel"
          }),
          field("ties.study", "Study ties", TemplateValueType.TEXT, false, ["Education"], 50, ["study ties", "student evidence"], {
            clientConfirmationCategory: "visitor_travel"
          }),
          field("ties.family", "Family ties", TemplateValueType.TEXT, false, ["Relationship"], 60, ["family ties"], {
            clientConfirmationCategory: "visitor_travel"
          }),
          field("ties.property_business", "Property / business ties", TemplateValueType.TEXT, false, ["Financial", "Employment"], 70, ["property ties", "business ties"], {
            clientConfirmationCategory: "visitor_travel"
          }),
          field("visa.travel_history", "Previous travel history", TemplateValueType.TEXT, false, ["Travel"], 80, ["travel history", "previous travel"]),
          field("visa.refusals", "Refusals / cancellations", TemplateValueType.TEXT, false, ["Travel", "Statements / Declarations"], 90, ["refusals", "cancellations"], {
            unsafe: true,
            clientConfirmationCategory: "character_declaration"
          }),
          ...declarationFields(100)
        ]
      }
    ],
    requirements: [
      { category: "Identity", label: "Passport evidence", description: "Current passport identity evidence.", ruleKey: "identity.passport", required: true },
      { category: "Travel", label: "Travel purpose and itinerary", description: "Purpose of visit and itinerary evidence.", ruleKey: "travel.itinerary", required: true },
      { category: "Financial", label: "Financial capacity evidence", description: "Funds and financial support evidence.", ruleKey: "financial.capacity", required: true },
      { category: "Other Evidence", label: "Home ties evidence", description: "Employment, family, study, or property/business ties evidence.", ruleKey: "ties.home", required: true }
    ],
    checklist: [
      { category: "Identity", label: "Identity details reviewed", required: true, sortOrder: 10 },
      { category: "Travel", label: "Purpose of visit and itinerary reviewed", required: true, sortOrder: 20 },
      { category: "Financial", label: "Funds and sponsor support reviewed", required: true, sortOrder: 30 },
      { category: "Other Evidence", label: "Home ties evidence reviewed", required: true, sortOrder: 40 }
    ]
  }
};

// Reuse skilled templates after initial declaration.
defs["190"].sections = [...defs["189"].sections, defs["190"].sections[defs["190"].sections.length - 1]];
defs["491"].sections = [...defs["189"].sections, defs["491"].sections[defs["491"].sections.length - 1]];

export function normalizeVisaSubclassCode(value: string) {
  const trimmed = value.trim();
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  return trimmed;
}

export function getVisaSubclassDefinition(subclassCode: string) {
  return defs[normalizeVisaSubclassCode(subclassCode)] ?? defs["500"];
}

export function listVisaSubclassDefinitions() {
  return Object.values(defs);
}
