export type DocumentExtractionSchemaKey =
  | "PASSPORT"
  | "PTE"
  | "IELTS"
  | "TOEFL_OET"
  | "COE"
  | "RESUME"
  | "PAYSLIP"
  | "BANK_STATEMENT"
  | "VISA_GRANT"
  | "SKILLS_ASSESSMENT"
  | "EMPLOYMENT_REFERENCE"
  | "MARRIAGE_CERTIFICATE"
  | "BIRTH_CERTIFICATE"
  | "POLICE_CLEARANCE"
  | "STATEMENT"
  | "OTHER";

export function detectExtractionSchema(fileName: string, extractedText = ""): {
  schema: DocumentExtractionSchemaKey;
  supported: boolean;
  manualReviewReason?: string;
} {
  const haystack = `${fileName} ${extractedText}`.toLowerCase();
  if (/passport|travel document|mrz/.test(haystack)) return { schema: "PASSPORT", supported: true };
  if (/\bpte\b|pearson/.test(haystack)) return { schema: "PTE", supported: true };
  if (/\bielts\b/.test(haystack)) return { schema: "IELTS", supported: true };
  if (/toefl|\boet\b/.test(haystack)) return { schema: "TOEFL_OET", supported: true };
  if (/confirmation of enrolment|\bcoe\b|cricos/.test(haystack)) return { schema: "COE", supported: true };
  if (/resume|curriculum vitae|\bcv\b/.test(haystack)) return { schema: "RESUME", supported: true };
  if (/payslip|pay slip|salary/.test(haystack)) return { schema: "PAYSLIP", supported: true };
  if (/bank statement|transaction account|available balance/.test(haystack)) return { schema: "BANK_STATEMENT", supported: true };
  if (/visa grant|grant notice|vevo/.test(haystack)) return { schema: "VISA_GRANT", supported: true };
  if (/skills assessment|assessment outcome|anzsco/.test(haystack)) return { schema: "SKILLS_ASSESSMENT", supported: true };
  if (/employment reference|reference letter|employment verification/.test(haystack)) return { schema: "EMPLOYMENT_REFERENCE", supported: true };
  if (/marriage certificate/.test(haystack)) return { schema: "MARRIAGE_CERTIFICATE", supported: true };
  if (/birth certificate/.test(haystack)) return { schema: "BIRTH_CERTIFICATE", supported: true };
  if (/police clearance|national police|criminal history/.test(haystack)) return { schema: "POLICE_CLEARANCE", supported: true };
  if (/statement|sop|genuine student|declaration/.test(haystack)) return { schema: "STATEMENT", supported: true };
  return {
    schema: "OTHER",
    supported: false,
    manualReviewReason: "No document-specific extraction schema matched this upload. Aria will store the file for secure review, but extraction should be treated as manual-review only."
  };
}
