import { extractDocumentData, type DocumentAiResult } from "@/lib/services/document-ai";

export async function extractDocumentResult(bytes: Buffer, mimeType: string): Promise<DocumentAiResult> {
  return extractDocumentData(bytes, mimeType);
}

export async function extractReadableText(bytes: Buffer, mimeType: string) {
  const result = await extractDocumentResult(bytes, mimeType);
  return result.extractedText || result.warnings.join(" ");
}
