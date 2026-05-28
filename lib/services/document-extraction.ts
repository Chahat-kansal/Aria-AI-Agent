import { extractDocumentData, type DocumentAiResult } from "@/lib/services/document-ai";
import { detectExtractionSchema } from "@/lib/services/document-extraction-schemas";
import { normalizeExtractedKeyValues } from "@/lib/services/document-field-normalization";
import { assessDocumentQuality } from "@/lib/services/document-quality";

export async function extractDocumentResult(bytes: Buffer, mimeType: string, fileName = "uploaded-document"): Promise<DocumentAiResult> {
  const result = await extractDocumentData(bytes, mimeType);
  const normalizedKeyValues = normalizeExtractedKeyValues(result.keyValues ?? []);
  const schema = detectExtractionSchema(fileName, result.extractedText);
  const documentQuality = assessDocumentQuality({
    fileName,
    mimeType,
    bytes,
    extraction: result
  });
  const warnings = [...result.warnings];
  if (!result.extractedText.trim()) {
    warnings.push("text_extraction_empty: no extracted text is available for this document.");
  }
  if (!schema.supported) {
    warnings.push(`unsupported_document_type: ${schema.manualReviewReason ?? "No supported extraction schema matched this document."}`);
  }
  if (result.confidence < 0.5 || documentQuality.status !== "GOOD_QUALITY") {
    warnings.push("needs_manual_review: extraction confidence or document quality is below the automatic-use threshold.");
  }
  return {
    ...result,
    normalizedKeyValues,
    documentQuality,
    warnings: [...new Set([...warnings, ...documentQuality.warnings])]
  };
}

export async function extractReadableText(bytes: Buffer, mimeType: string) {
  const result = await extractDocumentResult(bytes, mimeType);
  return result.extractedText || result.warnings.join(" ");
}
