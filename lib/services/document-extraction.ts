const pdfParse = require("pdf-parse");

export async function extractReadableText(bytes: Buffer, mimeType: string) {
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("csv")) {
    return bytes.toString("utf8").replace(/\s+/g, " ").trim();
  }

  if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
    try {
      const parsed = await pdfParse(bytes);
      const text = parsed.text.replace(/\s+/g, " ").trim();

      if (text.length > 50) {
        return text.slice(0, 30000);
      }

      return "PDF appears scanned or image-based. OCR provider is required for full extraction.";
    } catch {
      return "PDF text extraction failed. Agent review required.";
    }
  }

  if (mimeType.startsWith("image/")) {
    return "Image document uploaded. OCR provider is required for full extraction.";
  }

  return bytes
    .toString("utf8")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}