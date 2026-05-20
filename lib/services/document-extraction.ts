import { extractDocumentData, type DocumentAiResult } from "@/lib/services/document-ai";
import { normalizeExtractedKeyValues } from "@/lib/services/document-field-normalization";
import { assessDocumentQuality } from "@/lib/services/document-quality";

export async function extractDocumentResult(bytes: Buffer, mimeType: string, fileName = "uploaded-document"): Promise<DocumentAiResult> {
  const result = await extractDocumentData(bytes, mimeType);
  const normalizedKeyValues = normalizeExtractedKeyValues(result.keyValues ?? []);
  const documentQuality = assessDocumentQuality({
    fileName,
    mimeType,
    bytes,
    extraction: result
  });
  return {
    ...result,
    normalizedKeyValues,
    documentQuality,
    warnings: [...result.warnings, ...documentQuality.warnings.filter((warning) => !result.warnings.includes(warning))]
  };
}

export async function extractReadableText(bytes: Buffer, mimeType: string) {
  const result = await extractDocumentResult(bytes, mimeType);
  return result.extractedText || result.warnings.join(" ");
}
