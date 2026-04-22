export function extractReadableText(bytes: Buffer, mimeType: string) {
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("csv")) {
    return bytes.toString("utf8").replace(/\s+/g, " ").trim();
  }

  // Lightweight fallback for PDFs and office exports: this does not parse layout,
  // but it preserves readable embedded text when available and stays server-safe.
  return bytes
    .toString("utf8")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}
