export type DocumentPipelineResult = {
  classification: string;
  extractionStatus: "queued" | "extracted" | "needs_review";
  reviewStatus: "pending" | "verified" | "flagged";
};

export async function runDocumentPipeline(fileName: string): Promise<DocumentPipelineResult> {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const classification = extension === "pdf" ? "Forms" : "Other Evidence";
  return {
    classification,
    extractionStatus: "queued",
    reviewStatus: "pending"
  };
}
