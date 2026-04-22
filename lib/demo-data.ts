export const overviewStats = [
  { label: "Active matters", value: "42", delta: "+6 this month" },
  { label: "Submission readiness avg", value: "78%", delta: "+4%" },
  { label: "Open validation issues", value: "19", delta: "5 critical" },
  { label: "Updates awaiting review", value: "3", delta: "2 high impact" }
];

export const matters = Array.from({ length: 10 }).map((_, i) => ({
  id: `matter-${i + 1}`,
  client: ["Aisha Rahman", "Luca Rossi", "Priya Menon", "Daniel Kim", "Maria Santos"][i % 5],
  title: ["Subclass 189 Skilled Independent", "Subclass 482 Employer Sponsored", "Subclass 500 Student", "Partner 820/801", "Subclass 190 State Nominated"][i % 5],
  visaSubclass: ["189", "482", "500", "820", "190"][i % 5],
  visaStream: ["Points-tested", "Medium-term", "Higher Education", "Onshore", "General Skilled"][i % 5],
  status: ["In progress", "Awaiting docs", "Ready for review", "Draft in progress"][i % 4],
  stage: ["Intake", "Evidence", "Field review", "Validation", "Submission prep"][i % 5],
  readiness: 58 + i * 4
}));

export const documents = Array.from({ length: 32 }).map((_, i) => ({
  id: `doc-${i + 1}`,
  fileName: `Document-${i + 1}.pdf`,
  category: ["Identity", "Travel", "Employment", "Education", "Financial", "Relationship", "Health / Police", "Forms", "Other Evidence"][i % 9],
  extractionStatus: ["Queued", "Extracted", "Needs review"][i % 3],
  reviewStatus: ["Pending", "Verified", "Flagged"][i % 3],
  matterId: matters[i % matters.length].id
}));

export const officialUpdates = Array.from({ length: 7 }).map((_, i) => ({
  id: `upd-${i + 1}`,
  source: ["Department of Home Affairs", "Federal Register of Legislation", "OMARA/MARA notice"][i % 3],
  title: ["Skilled occupation list amendments", "Student visa genuine student guidance update", "Form 80 supporting evidence adjustment", "English language evidence policy note", "Priority processing category revision", "Health examination validity clarification", "Character document translation reminder"][i],
  publishedAt: `2026-0${(i % 3) + 1}-1${i}`,
  impact: ["High", "Medium", "Low"][i % 3]
}));

export const validationIssues = [
  "Missing passport expiry",
  "Inconsistent name spelling across identity docs",
  "Address mismatch between bank statement and form draft",
  "Employment dates conflict between CV and reference",
  "Missing required evidence: AFP police check",
  "Unsupported field value in prior travel history",
  "Stale health document older than 12 months",
  "Missing certified translation"
];
