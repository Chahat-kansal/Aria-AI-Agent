export type ImmigrationSourceAuthority =
  | "OFFICIAL_HOME_AFFAIRS"
  | "OFFICIAL_FEDERAL_REGISTER"
  | "OFFICIAL_STATE_GOV"
  | "REGULATOR_OMARA"
  | "OFFICIAL_SKILLS_AUTHORITY"
  | "SECONDARY_REFERENCE"
  | "INTERNAL_MANUAL_REVIEW";

export type CrawlAllowedStatus =
  | "UNKNOWN"
  | "ALLOWED"
  | "DISALLOWED"
  | "MANUAL_REVIEW_REQUIRED";

export type ImmigrationSourceType =
  | "VISA_LIST"
  | "VISA_DETAIL"
  | "PDF_FORMS_INDEX"
  | "ONLINE_FORMS_INDEX"
  | "PDF_FORM"
  | "LEGISLATIVE_INSTRUMENT"
  | "STATE_NOMINATION"
  | "OCCUPATION_LIST"
  | "ASSESSING_AUTHORITY"
  | "PROFESSIONAL_CONDUCT"
  | "SECONDARY_IDEAS";

export type ImmigrationSourceRecord = {
  sourceId: string;
  title: string;
  url: string;
  authority: ImmigrationSourceAuthority;
  sourceType: ImmigrationSourceType;
  crawlAllowedStatus: CrawlAllowedStatus;
  updateCadence: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "MANUAL";
  trustLevel: "HIGH" | "MEDIUM" | "LOW";
  mayStoreFullText: boolean;
  mayStoreMetadata: boolean;
  notes: string;
};

const registry: ImmigrationSourceRecord[] = [
  {
    sourceId: "home-affairs-visa-list",
    title: "Department of Home Affairs visa list",
    url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing",
    authority: "OFFICIAL_HOME_AFFAIRS",
    sourceType: "VISA_LIST",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "WEEKLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Primary visa discovery source. Use metadata-first ingestion and manual review if robots/terms need checking."
  },
  {
    sourceId: "home-affairs-pdf-forms",
    title: "Department of Home Affairs PDF forms index",
    url: "https://immi.homeaffairs.gov.au/help-support/departmental-forms/pdf-forms",
    authority: "OFFICIAL_HOME_AFFAIRS",
    sourceType: "PDF_FORMS_INDEX",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "WEEKLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Use for official PDF form discovery and checksum monitoring."
  },
  {
    sourceId: "home-affairs-online-forms",
    title: "Department of Home Affairs online forms index",
    url: "https://immi.homeaffairs.gov.au/help-support/departmental-forms/online-forms",
    authority: "OFFICIAL_HOME_AFFAIRS",
    sourceType: "ONLINE_FORMS_INDEX",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "WEEKLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Use for online-only application entries. Do not treat these as downloadable PDFs."
  },
  {
    sourceId: "immiaccount-reference",
    title: "ImmiAccount reference entry",
    url: "https://immi.homeaffairs.gov.au/help-support/applying-online-or-on-paper/online",
    authority: "OFFICIAL_HOME_AFFAIRS",
    sourceType: "ONLINE_FORMS_INDEX",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "MONTHLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Reference-only source for online lodgement workflow context."
  },
  {
    sourceId: "federal-register-migration",
    title: "Federal Register of Legislation migration placeholder",
    url: "https://www.legislation.gov.au/",
    authority: "OFFICIAL_FEDERAL_REGISTER",
    sourceType: "LEGISLATIVE_INSTRUMENT",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "WEEKLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Official legislative instruments should be linked here after source-specific discovery is verified."
  },
  {
    sourceId: "omara-code-of-conduct",
    title: "OMARA professional conduct placeholder",
    url: "https://www.mara.gov.au/",
    authority: "REGULATOR_OMARA",
    sourceType: "PROFESSIONAL_CONDUCT",
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED",
    updateCadence: "MONTHLY",
    trustLevel: "HIGH",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Professional conduct and regulatory guidance placeholder."
  },
  ...(["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const).map((state) => ({
    sourceId: `state-nomination-${state.toLowerCase()}`,
    title: `${state} state nomination placeholder`,
    url: "https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list",
    authority: "OFFICIAL_STATE_GOV" as const,
    sourceType: "STATE_NOMINATION" as const,
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED" as const,
    updateCadence: "WEEKLY" as const,
    trustLevel: "HIGH" as const,
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: `${state} state nomination source placeholder pending per-state verified source URL.`
  })),
  ...[
    ["acs", "ACS"],
    ["vetassess", "VETASSESS"],
    ["engineers-australia", "Engineers Australia"],
    ["cpa-australia", "CPA Australia"],
    ["ca-anz", "CA ANZ"],
    ["ipa", "Institute of Public Accountants"],
    ["tra", "Trades Recognition Australia"],
    ["anmac", "ANMAC"],
    ["aitsl", "AITSL"],
    ["acecqa", "ACECQA"]
  ].map(([slug, label]) => ({
    sourceId: `skills-authority-${slug}`,
    title: `${label} assessing authority placeholder`,
    url: "https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list",
    authority: "OFFICIAL_SKILLS_AUTHORITY" as const,
    sourceType: "ASSESSING_AUTHORITY" as const,
    crawlAllowedStatus: "MANUAL_REVIEW_REQUIRED" as const,
    updateCadence: "MONTHLY" as const,
    trustLevel: "HIGH" as const,
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: `${label} source placeholder pending authority-specific verified URL and crawl review.`
  })),
  {
    sourceId: "secondary-reference-migration-planning",
    title: "Secondary migration workflow ideas placeholder",
    url: "https://example.invalid/secondary-reference",
    authority: "SECONDARY_REFERENCE",
    sourceType: "SECONDARY_IDEAS",
    crawlAllowedStatus: "DISALLOWED",
    updateCadence: "MANUAL",
    trustLevel: "LOW",
    mayStoreFullText: false,
    mayStoreMetadata: true,
    notes: "Secondary references may inform workflow ideas only and must always be marked needs review."
  }
];

export function listImmigrationSources() {
  return [...registry];
}

export function getSourceById(sourceId: string) {
  return registry.find((source) => source.sourceId === sourceId);
}

export function listSourcesByAuthority(authority: ImmigrationSourceAuthority) {
  return registry.filter((source) => source.authority === authority);
}

export function listCrawlableSources() {
  return registry.filter((source) => source.crawlAllowedStatus === "ALLOWED" || source.crawlAllowedStatus === "MANUAL_REVIEW_REQUIRED");
}

export function assertOfficialSource(source: ImmigrationSourceRecord) {
  if (source.authority === "SECONDARY_REFERENCE" || source.authority === "INTERNAL_MANUAL_REVIEW") {
    throw new Error(`Source ${source.sourceId} is not an official authority and must not be treated as binding.`);
  }
  return source;
}
