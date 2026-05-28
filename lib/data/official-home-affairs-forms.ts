export type OfficialHomeAffairsSeedForm = {
  formNumber: string;
  title: string;
  category:
    | "Representation"
    | "Character"
    | "Personal particulars"
    | "Student"
    | "Visitor"
    | "Partner"
    | "Family"
    | "Skilled"
    | "Employer sponsored"
    | "Bridging"
    | "Citizenship"
    | "Health"
    | "Consent / child travel"
    | "Sponsorship / nomination"
    | "Protection / humanitarian"
    | "Other";
  sourceUrl?: string;
  sourceName: string;
  subclassCodes: string[];
  supportStatus:
    | "ONLINE_ONLY"
    | "MANUAL_ONLY"
    | "FILLABLE_PDF"
    | "MAPPING_REQUIRED"
    | "NEEDS_REVIEW"
    | "SUPERSEDED";
  lifecycleStatus:
    | "CURRENT"
    | "NEEDS_REVIEW"
    | "SUPERSEDED"
    | "UNKNOWN";
  notes?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

const formsPage = "https://immi.homeaffairs.gov.au/help-support/departmental-forms/pdf-forms";
const onlineFormsPage = "https://immi.homeaffairs.gov.au/help-support/departmental-forms/online-forms";

export const OFFICIAL_HOME_AFFAIRS_FORMS: OfficialHomeAffairsSeedForm[] = [
  {
    formNumber: "956",
    title: "Appointment of a registered migration agent, legal practitioner or exempt person",
    category: "Representation",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/956.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801", "309/100", "590", "300", "407", "494", "870"],
    supportStatus: "FILLABLE_PDF",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "956A",
    title: "Appointment or withdrawal of an authorised recipient",
    category: "Representation",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/956a.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801", "309/100", "590", "300", "407", "494", "870"],
    supportStatus: "FILLABLE_PDF",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "80",
    title: "Personal particulars for character assessment",
    category: "Character",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/80.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801", "309/100", "590", "300", "407", "494", "870", "866"],
    supportStatus: "FILLABLE_PDF",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "1221",
    title: "Additional personal particulars information",
    category: "Personal particulars",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/1221.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801", "309/100", "590", "300", "407", "494", "870", "866"],
    supportStatus: "FILLABLE_PDF",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "157A",
    title: "Application for a student visa",
    category: "Student",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/157a.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500"],
    supportStatus: "MAPPING_REQUIRED",
    lifecycleStatus: "NEEDS_REVIEW",
    notes: "Availability and current use should be verified against current Department guidance.",
    priority: "HIGH"
  },
  {
    formNumber: "157G",
    title: "Student Guardian related application form",
    category: "Student",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["590"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for coverage. Verify current title, lifecycle, and official availability before treating as active.",
    priority: "MEDIUM"
  },
  {
    formNumber: "157N",
    title: "Student Guardian / nomination related form",
    category: "Student",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["590"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for coverage. Verify current title, lifecycle, and official availability before treating as active.",
    priority: "MEDIUM"
  },
  {
    formNumber: "STUDENT-ONLINE",
    title: "Student visa online application entry",
    category: "Student",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    notes: "Primary lodgement remains online and Aria does not lodge applications.",
    priority: "HIGH"
  },
  {
    formNumber: "1419",
    title: "Application for a Visitor visa - Tourist stream",
    category: "Visitor",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/1419.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["600"],
    supportStatus: "MAPPING_REQUIRED",
    lifecycleStatus: "NEEDS_REVIEW",
    notes: "Verify current use versus online application pathways.",
    priority: "HIGH"
  },
  {
    formNumber: "1257",
    title: "Undertaking declaration / visitor related form",
    category: "Visitor",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["600", "870"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for visitor coverage. Verify current official usage.",
    priority: "MEDIUM"
  },
  {
    formNumber: "1257A",
    title: "Visitor related supplementary form",
    category: "Visitor",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["600", "870"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for visitor coverage. Verify current official usage.",
    priority: "MEDIUM"
  },
  {
    formNumber: "VISITOR-ONLINE",
    title: "Visitor visa online application entry",
    category: "Visitor",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["600", "601", "651"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "47SP",
    title: "Application for migration to Australia by a partner",
    category: "Partner",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["820/801", "309/100"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Historic/common partner form reference. Verify current online/PDF lifecycle.",
    priority: "HIGH"
  },
  {
    formNumber: "40SP",
    title: "Sponsorship for a partner to migrate to Australia",
    category: "Partner",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["820/801", "309/100"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Historic/common partner sponsorship form reference. Verify current lifecycle.",
    priority: "HIGH"
  },
  {
    formNumber: "888",
    title: "Statutory declaration by a supporting witness in relation to a Partner or Prospective Marriage visa application",
    category: "Partner",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["820/801", "309/100", "300"],
    supportStatus: "MAPPING_REQUIRED",
    lifecycleStatus: "NEEDS_REVIEW",
    notes: "Commonly referenced in partner workflows. Add official PDF URL once verified.",
    priority: "HIGH"
  },
  {
    formNumber: "47CH",
    title: "Application for migration to Australia by a child",
    category: "Family",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["101", "802", "445"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Verify lifecycle and official availability.",
    priority: "MEDIUM"
  },
  {
    formNumber: "40CH",
    title: "Sponsorship for migration to Australia",
    category: "Family",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["101", "802", "445", "103", "143", "173"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    priority: "MEDIUM"
  },
  {
    formNumber: "47PA",
    title: "Application for migration to Australia by a parent",
    category: "Family",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["103", "143", "173"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    priority: "MEDIUM"
  },
  {
    formNumber: "1229",
    title: "Consent form to grant an Australian visa to a child under the age of 18 years",
    category: "Consent / child travel",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/1229.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["101", "802", "445", "500", "590", "600"],
    supportStatus: "FILLABLE_PDF",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "26",
    title: "Medical treatment consent / health related form",
    category: "Health",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "485", "482", "186", "600", "820/801", "309/100", "866"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Verify exact current official title and lifecycle.",
    priority: "LOW"
  },
  {
    formNumber: "160",
    title: "Health undertaking / health related form",
    category: "Health",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "485", "482", "186", "600", "820/801", "309/100", "866"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Verify exact current official title and lifecycle.",
    priority: "LOW"
  },
  {
    formNumber: "47ES",
    title: "Employer sponsored related form",
    category: "Employer sponsored",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["482", "186", "494"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for employer-sponsored coverage. Verify current official status and title.",
    priority: "MEDIUM"
  },
  {
    formNumber: "1446",
    title: "Business skills / investment related form",
    category: "Skilled",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["188", "888"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Requested for business/investment coverage. Verify current official status and title.",
    priority: "LOW"
  },
  {
    formNumber: "NOMINATION-ONLINE",
    title: "Employer sponsorship / nomination online entry",
    category: "Sponsorship / nomination",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["482", "186", "494", "407"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "189-ONLINE",
    title: "Skilled Independent online application entry",
    category: "Skilled",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["189"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "190-ONLINE",
    title: "Skilled Nominated online application entry",
    category: "Skilled",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["190"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "491-ONLINE",
    title: "Skilled Work Regional online application entry",
    category: "Skilled",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["491", "191"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    priority: "HIGH"
  },
  {
    formNumber: "BRIDGING-ONLINE",
    title: "Bridging visa online / operational entry",
    category: "Bridging",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["010", "020", "030", "050", "051"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    notes: "Bridging workflows are registered operationally; no automatic lodging claim.",
    priority: "MEDIUM"
  },
  {
    formNumber: "1300T",
    title: "Application for Australian citizenship by conferral",
    category: "Citizenship",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["citizenship-conferral"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Verify current title/source/lifecycle from official citizenship pages.",
    priority: "MEDIUM"
  },
  {
    formNumber: "1290",
    title: "Application for Australian citizenship by descent",
    category: "Citizenship",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["citizenship-descent"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    priority: "MEDIUM"
  },
  {
    formNumber: "118",
    title: "Application for evidence of Australian citizenship",
    category: "Citizenship",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["evidence-of-citizenship"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    priority: "MEDIUM"
  },
  {
    formNumber: "119",
    title: "Citizenship-related supporting / identity form",
    category: "Citizenship",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["evidence-of-citizenship", "citizenship-conferral"],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    priority: "LOW"
  },
  {
    formNumber: "866-ONLINE",
    title: "Protection / humanitarian online entry",
    category: "Protection / humanitarian",
    sourceUrl: onlineFormsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: ["866", "200", "201", "202", "203", "204"],
    supportStatus: "ONLINE_ONLY",
    lifecycleStatus: "CURRENT",
    notes: "Protection/humanitarian workflows remain manual-review and legal-judgement intensive.",
    priority: "LOW"
  },
  {
    formNumber: "FORMS-PAGE-REFERENCE",
    title: "Department PDF forms index reference",
    category: "Other",
    sourceUrl: formsPage,
    sourceName: "Department of Home Affairs",
    subclassCodes: [],
    supportStatus: "NEEDS_REVIEW",
    lifecycleStatus: "UNKNOWN",
    notes: "Reference row for the official PDF forms listing page.",
    priority: "LOW"
  }
];
