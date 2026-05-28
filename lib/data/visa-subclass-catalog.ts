import fs from "fs";
import path from "path";

export type VisaSubclassRegistryStatus =
  | "ACTIVE"
  | "CLOSED"
  | "SUPERSEDED"
  | "UNKNOWN"
  | "NEEDS_REVIEW";

export type VisaSubclassRegistrySupportLevel =
  | "FULL_FIELD_AUTOFILL"
  | "DRAFT_TEMPLATE"
  | "CHECKLIST_ONLY"
  | "SCAFFOLD_ONLY"
  | "NEEDS_REVIEW";

export type VisaSubclassCatalogRecord = {
  subclassCode: string;
  normalizedCode: string;
  name: string;
  stream?: string;
  family: string;
  status: VisaSubclassRegistryStatus;
  supportLevel: VisaSubclassRegistrySupportLevel;
  sourceUrl?: string;
  fieldCoveragePercent: number;
  formCoveragePercent: number;
  mappingNotes: string;
  reviewRequired: true;
  priority: "HIGH" | "MEDIUM" | "LOW";
};

const CATALOG: VisaSubclassCatalogRecord[] = [
  { subclassCode: "500", normalizedCode: "500", name: "Student visa", stream: "Student", family: "Student / Graduate", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", sourceUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500", fieldCoveragePercent: 84, formCoveragePercent: 42, mappingNotes: "Deep field-level draft support exists. Official form coverage remains partial and review-required.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "590", normalizedCode: "590", name: "Student Guardian visa", stream: "Guardian", family: "Student / Graduate", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 52, formCoveragePercent: 18, mappingNotes: "Deeper draft/checklist support exists, but official form mapping remains partial.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "485", normalizedCode: "485", name: "Temporary Graduate visa", stream: "Graduate", family: "Student / Graduate", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 82, formCoveragePercent: 36, mappingNotes: "Deep field-level draft support exists for graduate workflows.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "476", normalizedCode: "476", name: "Recognised Graduate visa", stream: "Graduate", family: "Student / Graduate", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 0, mappingNotes: "Registered for visibility. Source verification required for current availability and process.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "600", normalizedCode: "600", name: "Visitor visa", stream: "Visitor", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 79, formCoveragePercent: 28, mappingNotes: "Deep field-level visitor preparation support exists. Primary lodgement remains agent-reviewed.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "601", normalizedCode: "601", name: "Electronic Travel Authority", stream: "Visitor", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 15, formCoveragePercent: 0, mappingNotes: "Online/eligibility style workflow only. No form autofill claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "651", normalizedCode: "651", name: "eVisitor", stream: "Visitor", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 15, formCoveragePercent: 0, mappingNotes: "Online/eligibility style workflow only. No form autofill claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "771", normalizedCode: "771", name: "Transit visa", stream: "Transit", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 6, mappingNotes: "Transit workflow registered with checklist and intake guidance only.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "602", normalizedCode: "602", name: "Medical Treatment visa", stream: "Medical Treatment", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 20, formCoveragePercent: 8, mappingNotes: "Medical treatment workflow registered with checklist/intake guidance only.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "417", normalizedCode: "417", name: "Working Holiday visa", stream: "Working Holiday", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 4, mappingNotes: "Working holiday workflow registered with checklist/intake guidance only.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "462", normalizedCode: "462", name: "Work and Holiday visa", stream: "Work and Holiday", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 4, mappingNotes: "Work and holiday workflow registered with checklist/intake guidance only.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "870", normalizedCode: "870", name: "Sponsored Parent Temporary visa", stream: "Sponsored Parent", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 46, formCoveragePercent: 18, mappingNotes: "Checklist and staff-review draft support exists. Sponsorship evidence remains review-heavy.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "400", normalizedCode: "400", name: "Temporary Work (Short Stay Specialist)", stream: "Short Stay Specialist", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 42, formCoveragePercent: 14, mappingNotes: "Temporary specialist work scaffold and draft support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "403", normalizedCode: "403", name: "Temporary Work (International Relations) visa", stream: "International Relations", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 24, formCoveragePercent: 8, mappingNotes: "International relations workflow registered with checklist/intake guidance only.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "407", normalizedCode: "407", name: "Training visa", stream: "Training", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 49, formCoveragePercent: 16, mappingNotes: "Training-plan and nomination-oriented draft support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "408", normalizedCode: "408", name: "Temporary Activity visa", stream: "Temporary Activity", family: "Visitor / Temporary", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 43, formCoveragePercent: 12, mappingNotes: "Temporary activity support exists with review-required narrative handling.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "820/801", normalizedCode: "820/801", name: "Partner visa (onshore)", stream: "Partner Onshore", family: "Partner / Family", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 81, formCoveragePercent: 34, mappingNotes: "Deep partner evidence workflow and draft support exists. Unsafe relationship declarations remain review-gated.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "309/100", normalizedCode: "309/100", name: "Partner visa (offshore)", stream: "Partner Offshore", family: "Partner / Family", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 81, formCoveragePercent: 34, mappingNotes: "Deep offshore partner evidence workflow and draft support exists. Unsafe declarations remain review-gated.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "300", normalizedCode: "300", name: "Prospective Marriage visa", stream: "Prospective Marriage", family: "Partner / Family", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 47, formCoveragePercent: 18, mappingNotes: "Checklist and staff-review draft support exists for intention-to-marry evidence.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "461", normalizedCode: "461", name: "New Zealand Citizen Family Relationship visa", stream: "Family Relationship", family: "Partner / Family", status: "ACTIVE", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 24, formCoveragePercent: 8, mappingNotes: "Scaffold generated from family relationship workflow assumptions; legal/content review required.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "101", normalizedCode: "101", name: "Child visa", stream: "Child Offshore", family: "Partner / Family", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 38, formCoveragePercent: 12, mappingNotes: "Identity, parental responsibility, and custody scaffold exists.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "802", normalizedCode: "802", name: "Child visa", stream: "Child Onshore", family: "Partner / Family", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 38, formCoveragePercent: 12, mappingNotes: "Identity, parental responsibility, and custody scaffold exists.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "445", normalizedCode: "445", name: "Dependent Child visa", stream: "Dependent Child", family: "Partner / Family", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 20, formCoveragePercent: 6, mappingNotes: "Registered for coverage. Source verification required before production use.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "103", normalizedCode: "103", name: "Parent visa", stream: "Parent", family: "Partner / Family", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 36, formCoveragePercent: 12, mappingNotes: "Checklist and draft support exists. Balance-of-family and AoS logic remains review-heavy.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "143", normalizedCode: "143", name: "Contributory Parent visa", stream: "Contributory Parent", family: "Partner / Family", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 36, formCoveragePercent: 12, mappingNotes: "Checklist and draft support exists. Balance-of-family and AoS logic remains review-heavy.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "173", normalizedCode: "173", name: "Contributory Parent (Temporary) visa", stream: "Contributory Parent Temporary", family: "Partner / Family", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 6, mappingNotes: "Registered for visibility. Manual legal/content review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "189", normalizedCode: "189", name: "Skilled Independent visa", stream: "Skilled Independent", family: "Skilled", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 80, formCoveragePercent: 26, mappingNotes: "Deep points and skills-assessment draft support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "190", normalizedCode: "190", name: "Skilled Nominated visa", stream: "Skilled Nominated", family: "Skilled", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 80, formCoveragePercent: 28, mappingNotes: "Deep points and nomination draft support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "491", normalizedCode: "491", name: "Skilled Work Regional visa", stream: "Skilled Work Regional", family: "Skilled", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 80, formCoveragePercent: 28, mappingNotes: "Deep points and regional nomination/sponsor draft support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "191", normalizedCode: "191", name: "Permanent Residence (Skilled Regional) visa", stream: "Skilled Regional Permanent", family: "Skilled", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 22, formCoveragePercent: 4, mappingNotes: "Checklist-only coverage pending deeper permanent regional workflow mapping.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "887", normalizedCode: "887", name: "Skilled Regional visa", stream: "Regional Skilled Permanent", family: "Skilled", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 4, mappingNotes: "Legacy/regional permanent visibility entry. Current relevance requires source verification.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "482", normalizedCode: "482", name: "Skills in Demand / TSS visa", stream: "Employer Sponsored", family: "Employer Sponsored", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 82, formCoveragePercent: 32, mappingNotes: "Deep sponsor, nomination, employment, and declaration-safe review support exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "186", normalizedCode: "186", name: "Employer Nomination Scheme visa", stream: "Employer Sponsored", family: "Employer Sponsored", status: "ACTIVE", supportLevel: "FULL_FIELD_AUTOFILL", fieldCoveragePercent: 81, formCoveragePercent: 30, mappingNotes: "Deep employer-sponsored field mapping exists.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "494", normalizedCode: "494", name: "Skilled Employer Sponsored Regional visa", stream: "Employer Sponsored Regional", family: "Employer Sponsored", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 58, formCoveragePercent: 18, mappingNotes: "Regional employer-sponsored draft structure exists; full field parity still incomplete.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "188", normalizedCode: "188", name: "Business Innovation and Investment visa", stream: "Business / Investment", family: "Business / Investment", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 22, formCoveragePercent: 8, mappingNotes: "Legacy/business workflow registered for visibility. Streams and status require source verification.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "188A", normalizedCode: "188A", name: "Business Innovation stream", stream: "Business Innovation", family: "Business / Investment", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 20, formCoveragePercent: 8, mappingNotes: "Legacy/business stream placeholder; verify active availability.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "188B", normalizedCode: "188B", name: "Investor stream", stream: "Investor", family: "Business / Investment", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 20, formCoveragePercent: 8, mappingNotes: "Legacy/business stream placeholder; verify active availability.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "188E", normalizedCode: "188E", name: "Entrepreneur stream", stream: "Entrepreneur", family: "Business / Investment", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 20, formCoveragePercent: 8, mappingNotes: "Legacy/business stream placeholder; verify active availability.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "888", normalizedCode: "888", name: "Business Innovation and Investment (Permanent) visa", stream: "Business / Investment Permanent", family: "Business / Investment", status: "NEEDS_REVIEW", supportLevel: "SCAFFOLD_ONLY", fieldCoveragePercent: 22, formCoveragePercent: 8, mappingNotes: "Legacy/permanent business workflow registered for visibility.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "858", normalizedCode: "858", name: "National Innovation visa (subclass 858)", stream: "National Innovation", family: "Business / Investment", status: "ACTIVE", supportLevel: "DRAFT_TEMPLATE", fieldCoveragePercent: 44, formCoveragePercent: 10, mappingNotes: "Priority checklist and draft support exists, but criteria and narrative handling remain review-heavy.", reviewRequired: true, priority: "HIGH" },
  { subclassCode: "866", normalizedCode: "866", name: "Protection visa", stream: "Protection", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 18, formCoveragePercent: 6, mappingNotes: "Registered with protection/humanitarian caution. No legal-advice automation claim.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "200", normalizedCode: "200", name: "Refugee visa", stream: "Refugee", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 4, mappingNotes: "Checklist-only placeholder with manual review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "201", normalizedCode: "201", name: "In-country Special Humanitarian visa", stream: "Humanitarian", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 4, mappingNotes: "Checklist-only placeholder with manual review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "202", normalizedCode: "202", name: "Global Special Humanitarian visa", stream: "Humanitarian", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 4, mappingNotes: "Checklist-only placeholder with manual review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "203", normalizedCode: "203", name: "Emergency Rescue visa", stream: "Humanitarian", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 4, mappingNotes: "Checklist-only placeholder with manual review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "204", normalizedCode: "204", name: "Woman at Risk visa", stream: "Humanitarian", family: "Protection / Humanitarian", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 4, mappingNotes: "Checklist-only placeholder with manual review required.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "010", normalizedCode: "010", name: "Bridging Visa A", stream: "Bridging", family: "Bridging", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 12, formCoveragePercent: 2, mappingNotes: "Checklist-only operational support. No full application automation claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "020", normalizedCode: "020", name: "Bridging Visa B", stream: "Bridging", family: "Bridging", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 12, formCoveragePercent: 2, mappingNotes: "Checklist-only operational support. No full application automation claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "030", normalizedCode: "030", name: "Bridging Visa C", stream: "Bridging", family: "Bridging", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 12, formCoveragePercent: 2, mappingNotes: "Checklist-only operational support. No full application automation claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "050", normalizedCode: "050", name: "Bridging Visa E", stream: "Bridging", family: "Bridging", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 12, formCoveragePercent: 2, mappingNotes: "Checklist-only operational support. No full application automation claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "051", normalizedCode: "051", name: "Bridging Visa E", stream: "Bridging", family: "Bridging", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 12, formCoveragePercent: 2, mappingNotes: "Checklist-only operational support. No full application automation claim.", reviewRequired: true, priority: "MEDIUM" },
  { subclassCode: "citizenship-conferral", normalizedCode: "citizenship-conferral", name: "Citizenship by conferral", stream: "Citizenship", family: "Citizenship", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 10, mappingNotes: "Citizenship workflow registered with checklist-level support only.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "citizenship-descent", normalizedCode: "citizenship-descent", name: "Citizenship by descent", stream: "Citizenship", family: "Citizenship", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 10, mappingNotes: "Citizenship workflow registered with checklist-level support only.", reviewRequired: true, priority: "LOW" },
  { subclassCode: "evidence-of-citizenship", normalizedCode: "evidence-of-citizenship", name: "Evidence of Australian citizenship", stream: "Citizenship evidence", family: "Citizenship", status: "ACTIVE", supportLevel: "CHECKLIST_ONLY", fieldCoveragePercent: 16, formCoveragePercent: 12, mappingNotes: "Citizenship evidence workflow registered with checklist-level support only.", reviewRequired: true, priority: "LOW" }
];

type DiscoveredVisaSubclassRecord = {
  normalizedCode: string;
  subclassCode: string;
  name: string;
  url?: string;
};

function deriveFamily(name: string, url?: string) {
  const text = `${name} ${url ?? ""}`.toLowerCase();
  if (/student|guardian|graduate|elicos|school|education/.test(text)) return "Student / Graduate";
  if (/partner|family|parent|child|orphan|relative|adoption|carer/.test(text)) return "Partner / Family";
  if (/skilled|regional|innovation|talent|investor|business|employer|nomination|labour/.test(text)) {
    if (/business|investor|innovation|talent/.test(text)) return "Business / Investment";
    if (/employer|nomination|labour|temporary work|training|specialist/.test(text)) return "Employer Sponsored";
    return "Skilled";
  }
  if (/protection|humanitarian|refugee|safe haven/.test(text)) return "Protection / Humanitarian";
  if (/bridging/.test(text)) return "Bridging";
  if (/citizenship/.test(text)) return "Citizenship";
  if (/visitor|travel|holiday|transit|crew|medical treatment|temporary activity|temporary work/.test(text)) {
    return "Visitor / Temporary";
  }
  return "Other";
}

function deriveStream(name: string) {
  const streamMatch = name.match(/^(.*?)(?:\s+visa|\s+\(subclass)/i);
  return streamMatch?.[1]?.trim() || name.trim();
}

function deriveStatus(record: DiscoveredVisaSubclassRecord): VisaSubclassRegistryStatus {
  const text = `${record.name} ${record.url ?? ""}`.toLowerCase();
  if (/repealed|closed|superseded/.test(text)) return "CLOSED";
  if (["476", "887", "188", "188A", "188B", "188E", "888"].includes(record.normalizedCode)) return "NEEDS_REVIEW";
  return "ACTIVE";
}

function deriveSupportLevel(record: DiscoveredVisaSubclassRecord): VisaSubclassRegistrySupportLevel {
  const status = deriveStatus(record);
  if (status !== "ACTIVE") return "SCAFFOLD_ONLY";
  const family = deriveFamily(record.name, record.url);
  if (family === "Protection / Humanitarian" || family === "Citizenship") return "CHECKLIST_ONLY";
  return "SCAFFOLD_ONLY";
}

function derivePriority(record: DiscoveredVisaSubclassRecord): "HIGH" | "MEDIUM" | "LOW" {
  const code = record.normalizedCode;
  if (["590", "300", "407", "494", "870", "858"].includes(code)) return "HIGH";
  if (["462", "417", "403", "602", "192", "771"].includes(code)) return "MEDIUM";
  return "LOW";
}

function loadDiscoveredCatalogRecords(): VisaSubclassCatalogRecord[] {
  try {
    const filePath = path.join(process.cwd(), "data", "generated", "visa-subclasses.discovered.json");
    if (!fs.existsSync(filePath)) return [];
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8")) as { discovered?: DiscoveredVisaSubclassRecord[] };
    const discovered = payload.discovered ?? [];
    const curatedCodes = new Set(CATALOG.map((item) => item.normalizedCode));
    return discovered
      .filter((item) => item.normalizedCode && !curatedCodes.has(item.normalizedCode))
      .map((item) => {
        const family = deriveFamily(item.name, item.url);
        const supportLevel = deriveSupportLevel(item);
        const status = deriveStatus(item);
        return {
          subclassCode: item.subclassCode,
          normalizedCode: item.normalizedCode,
          name: item.name.replace(/\s+/g, " ").trim(),
          stream: deriveStream(item.name),
          family,
          status,
          supportLevel,
          sourceUrl: item.url,
          fieldCoveragePercent: supportLevel === "CHECKLIST_ONLY" ? 12 : 8,
          formCoveragePercent: 0,
          mappingNotes:
            "Scaffold generated from official subclass discovery output; requires legal/content review before production use.",
          reviewRequired: true,
          priority: derivePriority(item)
        };
      });
  } catch {
    return [];
  }
}

export function listVisaSubclassCatalog() {
  return [...CATALOG, ...loadDiscoveredCatalogRecords()];
}

export function getVisaSubclassCatalogRecord(code: string) {
  const normalized = normalizeVisaCatalogCode(code);
  return listVisaSubclassCatalog().find((item) => item.normalizedCode === normalized || item.subclassCode === code);
}

export function normalizeVisaCatalogCode(code: string) {
  const trimmed = code.trim();
  if (trimmed === "820" || trimmed === "801") return "820/801";
  if (trimmed === "309" || trimmed === "100") return "309/100";
  if (trimmed === "155" || trimmed === "157") return "155";
  if (trimmed === "160" || trimmed === "165") return "160";
  if (trimmed === "956" || trimmed === "977") return "956";
  if (trimmed === "121" || trimmed === "856") return "121";
  if (trimmed === "119" || trimmed === "857") return "119";
  return trimmed;
}
