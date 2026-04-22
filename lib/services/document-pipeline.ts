export type DocumentPipelineResult = {
  classification: string;
  extractionStatus: "queued" | "extracted" | "needs_review";
  reviewStatus: "pending" | "verified" | "flagged";
};

export async function runDocumentPipeline(fileName: string, extractedText = ""): Promise<DocumentPipelineResult> {
  const haystack = `${fileName} ${extractedText}`.toLowerCase();
  const classification = haystack.includes("passport") || haystack.includes("identity")
    ? "Identity"
    : haystack.includes("coe") || haystack.includes("enrol") || haystack.includes("course")
      ? "Education"
      : haystack.includes("bank") || haystack.includes("fund") || haystack.includes("financial")
        ? "Financial"
        : haystack.includes("oshc") || haystack.includes("insurance") || haystack.includes("health") || haystack.includes("police")
          ? "Health / Insurance"
          : haystack.includes("statement") || haystack.includes("declaration")
            ? "Statements / Declarations"
            : haystack.includes("form") || fileName.toLowerCase().endsWith(".pdf")
              ? "Forms"
              : "Other Evidence";
  return {
    classification,
    extractionStatus: extractedText.trim().length ? "extracted" : "needs_review",
    reviewStatus: "pending"
  };
}
