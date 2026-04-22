import { documents, matters, officialUpdates, validationIssues } from "@/lib/demo-data";
import type { ExtractedField, MatterImpact, OfficialUpdate, Task, ValidationIssue } from "@/lib/domain";

export const extractedFields: ExtractedField[] = [
  {
    id: "ef-1",
    matterId: "matter-1",
    documentId: "doc-1",
    fieldKey: "applicant_given_names",
    fieldLabel: "Given names",
    fieldValue: "Aisha Fatima",
    confidence: 0.98,
    sourceSnippet: "Given names: AISHA FATIMA",
    sourcePageRef: "Passport p.1",
    status: "high confidence",
    needsReview: false,
    createdAt: "2026-04-10"
  },
  {
    id: "ef-2",
    matterId: "matter-1",
    documentId: "doc-2",
    fieldKey: "passport_expiry",
    fieldLabel: "Passport expiry",
    fieldValue: "",
    confidence: 0.12,
    sourceSnippet: "No explicit expiry found",
    sourcePageRef: "Passport p.2",
    status: "missing",
    needsReview: true,
    createdAt: "2026-04-10"
  }
];

export const issueRows: ValidationIssue[] = validationIssues.map((title, idx) => ({
  id: `issue-${idx + 1}`,
  matterId: matters[idx % matters.length].id,
  severity: ["critical", "high", "medium", "low"][idx % 4] as ValidationIssue["severity"],
  type: "Data consistency",
  title,
  description: "Cross-document validation detected a discrepancy requiring manual review.",
  relatedFieldKey: idx % 2 ? "passport_expiry" : "residential_address",
  resolutionStatus: "Open",
  createdAt: `2026-04-${String(10 + idx).padStart(2, "0")}`
}));

export const impactRows: MatterImpact[] = matters.slice(0, 10).map((matter, idx) => ({
  id: `impact-${idx + 1}`,
  officialUpdateId: officialUpdates[idx % officialUpdates.length].id,
  matterId: matter.id,
  impactLevel: ["High", "Medium", "Low"][idx % 3] as MatterImpact["impactLevel"],
  reason: "Matched by visa subclass, stage, and near-term lodgement target date.",
  status: ["New", "Reviewing", "Actioned"][idx % 3] as MatterImpact["status"],
  createdAt: `2026-04-${String(idx + 1).padStart(2, "0")}`
}));

export const taskRows: Task[] = matters.slice(0, 10).map((matter, idx) => ({
  id: `task-${idx + 1}`,
  workspaceId: "ws-1",
  matterId: matter.id,
  assignedToUserId: `user-${(idx % 3) + 1}`,
  title: ["Request passport refresh", "Resolve address mismatch", "Review employment evidence", "Complete validation pass"][idx % 4],
  description: "Action required to advance submission readiness.",
  dueDate: `2026-04-${String(22 + (idx % 7)).padStart(2, "0")}`,
  status: ["Open", "In progress", "Done"][idx % 3] as Task["status"],
  priority: ["Urgent", "High", "Medium", "Low"][idx % 4] as Task["priority"]
}));

export function getOverview() {
  return {
    matters,
    documents,
    updates: officialUpdates as OfficialUpdate[],
    issues: issueRows,
    impacts: impactRows,
    tasks: taskRows,
    extractedFields
  };
}
