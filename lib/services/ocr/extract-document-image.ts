import { extractImageTextWithProvider } from "@/lib/services/ocr/ocr-provider";

export async function extractDocumentImage(bytes: Buffer, mimeType: string) {
  const extracted = await extractImageTextWithProvider(bytes, mimeType);
  return {
    provider: extracted.provider,
    model: extracted.model,
    extractedText: extracted.extractedText,
    extractedTextPreview: extracted.extractedText.slice(0, 1200),
    confidence: extracted.confidence,
    warnings: extracted.warnings,
    configured: extracted.configured
  };
}
