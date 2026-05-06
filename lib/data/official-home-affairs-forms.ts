export type OfficialHomeAffairsSeedForm = {
  formNumber: string;
  title: string;
  category: string;
  sourceUrl?: string;
  sourceName: string;
  subclassCodes: string[];
  supportStatus: "ONLINE_ONLY" | "MANUAL_ONLY" | "FILLABLE_PDF" | "MAPPING_REQUIRED";
  notes?: string;
};

export const OFFICIAL_HOME_AFFAIRS_FORMS: OfficialHomeAffairsSeedForm[] = [
  {
    formNumber: "956",
    title: "Appointment of a registered migration agent, legal practitioner or exempt person",
    category: "Representation",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/956.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801"],
    supportStatus: "FILLABLE_PDF"
  },
  {
    formNumber: "956A",
    title: "Appointment or withdrawal of an authorised recipient",
    category: "Representation",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/956a.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801"],
    supportStatus: "FILLABLE_PDF"
  },
  {
    formNumber: "1221",
    title: "Additional personal particulars information",
    category: "Personal particulars",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/1221.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801"],
    supportStatus: "FILLABLE_PDF"
  },
  {
    formNumber: "80",
    title: "Personal particulars for character assessment",
    category: "Character",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/80.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500", "600", "189", "190", "491", "482", "186", "820/801"],
    supportStatus: "FILLABLE_PDF"
  },
  {
    formNumber: "157A",
    title: "Application for a student visa",
    category: "Student visa",
    sourceUrl: "https://immi.homeaffairs.gov.au/form-listing/forms/157a.pdf",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500"],
    supportStatus: "MAPPING_REQUIRED",
    notes: "Availability and version should be verified against Department guidance."
  },
  {
    formNumber: "N/A",
    title: "Student visa online application",
    category: "Student visa",
    sourceUrl: "https://www.homeaffairs.gov.au/help-and-support/departmental-forms/online-forms",
    sourceName: "Department of Home Affairs",
    subclassCodes: ["500"],
    supportStatus: "ONLINE_ONLY",
    notes: "Primary lodgement remains online and Aria does not lodge applications."
  }
];

