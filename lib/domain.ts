export type Severity = "low" | "medium" | "high" | "critical";
export type ReviewState = "high confidence" | "supported" | "needs review" | "conflicting" | "missing";

export type Workspace = { id: string; name: string; slug: string; plan: "Starter" | "Growth" | "Pro"; createdAt: string };
export type User = { id: string; name: string; email: string; role: "Admin" | "Agent" | "Reviewer" | "Ops"; workspaceId: string };
export type Client = { id: string; workspaceId: string; firstName: string; lastName: string; dob: string; nationality: string; email: string; phone: string; notes?: string; createdAt: string };

export type Matter = {
  id: string;
  workspaceId: string;
  clientId: string;
  title: string;
  visaSubclass: string;
  visaStream: string;
  status: string;
  stage: string;
  lodgementTargetDate?: string;
  assignedToUserId: string;
  readinessScore: number;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MatterDocument = {
  id: string;
  workspaceId: string;
  clientId: string;
  matterId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  category: string;
  subcategory?: string;
  uploadedByUserId: string;
  extractionStatus: "Queued" | "Extracted" | "Needs review";
  reviewStatus: "Pending" | "Verified" | "Flagged";
  createdAt: string;
};

export type ExtractedField = {
  id: string;
  matterId: string;
  documentId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldValue: string;
  confidence: number;
  sourceSnippet: string;
  sourcePageRef: string;
  status: ReviewState;
  needsReview: boolean;
  createdAt: string;
};

export type ValidationIssue = {
  id: string;
  matterId: string;
  severity: Severity;
  type: string;
  title: string;
  description: string;
  relatedFieldKey?: string;
  resolutionStatus: "Open" | "In review" | "Resolved" | "Dismissed";
  createdAt: string;
};

export type OfficialUpdate = {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  updateType: string;
  effectiveDate?: string;
  publishedAt: string;
  rawContentHash: string;
  createdAt: string;
};

export type MatterImpact = {
  id: string;
  officialUpdateId: string;
  matterId: string;
  impactLevel: "Low" | "Medium" | "High";
  reason: string;
  status: "New" | "Reviewing" | "Actioned" | "Dismissed";
  createdAt: string;
};

export type Task = {
  id: string;
  workspaceId: string;
  matterId: string;
  assignedToUserId: string;
  title: string;
  description: string;
  dueDate: string;
  status: "Open" | "In progress" | "Done";
  priority: "Low" | "Medium" | "High" | "Urgent";
};
