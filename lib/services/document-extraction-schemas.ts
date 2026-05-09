export type DocumentExtractionSchemaKey =
  | "PASSPORT"
  | "CURRENT_VISA_EVIDENCE"
  | "PTE"
  | "IELTS"
  | "TOEFL_OET"
  | "COE"
  | "COMPLETION_LETTER"
  | "TRANSCRIPT"
  | "RESUME"
  | "PAYSLIP"
  | "EMPLOYMENT_CONTRACT"
  | "TAX_SUPER_EVIDENCE"
  | "BANK_STATEMENT"
  | "VISA_GRANT"
  | "SKILLS_ASSESSMENT"
  | "EMPLOYMENT_REFERENCE"
  | "MARRIAGE_CERTIFICATE"
  | "BIRTH_CERTIFICATE"
  | "CITIZENSHIP_CERTIFICATE"
  | "RELATIONSHIP_STATEMENT"
  | "FORM_888"
  | "INVITATION_LETTER"
  | "TRAVEL_ITINERARY"
  | "POLICE_CLEARANCE"
  | "AFP_CHECK"
  | "HEALTH_INSURANCE_POLICY"
  | "SPONSOR_NOMINATION"
  | "STATE_NOMINATION"
  | "STATEMENT"
  | "OTHER";

export function detectExtractionSchema(fileName: string, extractedText = ""): {
  schema: DocumentExtractionSchemaKey;
  supported: boolean;
  manualReviewReason?: string;
} {
  const haystack = `${fileName} ${extractedText}`.toLowerCase();
  if (/passport|travel document|mrz/.test(haystack)) return { schema: "PASSPORT", supported: true };
  if (/vevo|current visa|bridging visa|grant details/.test(haystack)) return { schema: "CURRENT_VISA_EVIDENCE", supported: true };
  if (/\bpte\b|pearson/.test(haystack)) return { schema: "PTE", supported: true };
  if (/\bielts\b/.test(haystack)) return { schema: "IELTS", supported: true };
  if (/toefl|\boet\b/.test(haystack)) return { schema: "TOEFL_OET", supported: true };
  if (/confirmation of enrolment|\bcoe\b|cricos/.test(haystack)) return { schema: "COE", supported: true };
  if (/completion letter|course completion|award letter|successful completion/.test(haystack)) return { schema: "COMPLETION_LETTER", supported: true };
  if (/academic transcript|official transcript|record of results/.test(haystack)) return { schema: "TRANSCRIPT", supported: true };
  if (/resume|curriculum vitae|\bcv\b/.test(haystack)) return { schema: "RESUME", supported: true };
  if (/payslip|pay slip|salary/.test(haystack)) return { schema: "PAYSLIP", supported: true };
  if (/employment contract|contract of employment|letter of offer/.test(haystack)) return { schema: "EMPLOYMENT_CONTRACT", supported: true };
  if (/group certificate|payment summary|tax return|notice of assessment|superannuation|super fund/.test(haystack)) return { schema: "TAX_SUPER_EVIDENCE", supported: true };
  if (/bank statement|transaction account|available balance/.test(haystack)) return { schema: "BANK_STATEMENT", supported: true };
  if (/visa grant|grant notice|vevo/.test(haystack)) return { schema: "VISA_GRANT", supported: true };
  if (/skills assessment|assessment outcome|anzsco/.test(haystack)) return { schema: "SKILLS_ASSESSMENT", supported: true };
  if (/employment reference|reference letter|employment verification/.test(haystack)) return { schema: "EMPLOYMENT_REFERENCE", supported: true };
  if (/marriage certificate/.test(haystack)) return { schema: "MARRIAGE_CERTIFICATE", supported: true };
  if (/birth certificate/.test(haystack)) return { schema: "BIRTH_CERTIFICATE", supported: true };
  if (/citizenship certificate|certificate of citizenship|permanent resident evidence/.test(haystack)) return { schema: "CITIZENSHIP_CERTIFICATE", supported: true };
  if (/relationship statement|partner statement|personal statement of relationship/.test(haystack)) return { schema: "RELATIONSHIP_STATEMENT", supported: true };
  if (/form 888|statutory declaration.*relationship|supporting witness/.test(haystack)) return { schema: "FORM_888", supported: true };
  if (/invitation letter|letter of invitation|inviter/.test(haystack)) return { schema: "INVITATION_LETTER", supported: true };
  if (/itinerary|flight booking|travel plan|travel itinerary/.test(haystack)) return { schema: "TRAVEL_ITINERARY", supported: true };
  if (/police clearance|national police|criminal history/.test(haystack)) return { schema: "POLICE_CLEARANCE", supported: true };
  if (/\bafp\b|australian federal police/.test(haystack)) return { schema: "AFP_CHECK", supported: true };
  if (/health insurance|oshc|ovhc|policy number/.test(haystack)) return { schema: "HEALTH_INSURANCE_POLICY", supported: true };
  if (/nomination approval|sponsor nomination|labour market testing|abn|acn/.test(haystack)) return { schema: "SPONSOR_NOMINATION", supported: true };
  if (/state nomination|invitation to apply|regional nomination/.test(haystack)) return { schema: "STATE_NOMINATION", supported: true };
  if (/statement|sop|genuine student|declaration/.test(haystack)) return { schema: "STATEMENT", supported: true };
  return {
    schema: "OTHER",
    supported: false,
    manualReviewReason: "No document-specific extraction schema matched this upload. Aria will store the file for secure review, but extraction should be treated as manual-review only."
  };
}
