export type DocumentQualityStatus =
  | "GOOD_QUALITY"
  | "ACCEPTABLE_WITH_REVIEW"
  | "POOR_QUALITY_REUPLOAD_RECOMMENDED"
  | "UNREADABLE_REUPLOAD_REQUIRED";

export type DocumentQualityIssue =
  | "BLURRY_IMAGE"
  | "LOW_RESOLUTION"
  | "GLARE_OR_REFLECTION"
  | "CROPPED_DOCUMENT"
  | "MISSING_CORNERS"
  | "ROTATED_OR_SKEWED"
  | "LOW_CONTRAST"
  | "UNREADABLE_TEXT"
  | "MULTIPLE_DOCUMENTS"
  | "PARTIAL_PAGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "FILE_TOO_SMALL"
  | "IMAGE_OCR_NOT_CONFIGURED";

export type DocumentQualityResult = {
  status: DocumentQualityStatus;
  score: number;
  issues: DocumentQualityIssue[];
  warnings: string[];
  reuploadMessage?: string;
  dimensions?: { width: number; height: number };
  autofillCriticalFieldsAllowed: boolean;
  agentOverrideRequired: boolean;
};

type ExtractionSummary = {
  confidence?: number;
  extractedTextPreview?: string;
  warnings?: string[];
  configured?: boolean;
  model?: string;
  provider?: string;
};

const supportedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/json"
]);

function readPngDimensions(bytes: Buffer) {
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function readJpegDimensions(bytes: Buffer) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) break;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(bytes: Buffer) {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = bytes.toString("ascii", 12, 16);
  if (type === "VP8X" && bytes.length >= 30) {
    const width = 1 + bytes.readUIntLE(24, 3);
    const height = 1 + bytes.readUIntLE(27, 3);
    return { width, height };
  }
  return null;
}

function imageDimensions(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png") return readPngDimensions(bytes);
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return readJpegDimensions(bytes);
  if (mimeType === "image/webp") return readWebpDimensions(bytes);
  return null;
}

function markerText(bytes: Buffer, fileName: string) {
  return `${fileName} ${bytes.toString("utf8", 0, Math.min(bytes.length, 4096))}`.toLowerCase();
}

function explicitQualityMarker(bytes: Buffer): DocumentQualityStatus | null {
  const text = bytes.toString("utf8", 0, Math.min(bytes.length, 8192));
  const match = text.match(/ARIA_QUALITY\s*=\s*(GOOD_QUALITY|ACCEPTABLE_WITH_REVIEW|POOR_QUALITY_REUPLOAD_RECOMMENDED|UNREADABLE_REUPLOAD_REQUIRED)/i);
  return match ? (match[1].toUpperCase() as DocumentQualityStatus) : null;
}

function issuesFromNameAndMarkers(bytes: Buffer, fileName: string): DocumentQualityIssue[] {
  const text = markerText(bytes, fileName);
  return [
    /blur|blurry/.test(text) ? "BLURRY_IMAGE" : null,
    /glare|reflection/.test(text) ? "GLARE_OR_REFLECTION" : null,
    /crop|cropped/.test(text) ? "CROPPED_DOCUMENT" : null,
    /missing corners?/.test(text) ? "MISSING_CORNERS" : null,
    /rotated|skew/.test(text) ? "ROTATED_OR_SKEWED" : null,
    /low contrast/.test(text) ? "LOW_CONTRAST" : null,
    /multiple documents?|multi doc/.test(text) ? "MULTIPLE_DOCUMENTS" : null,
    /partial page|partial/.test(text) ? "PARTIAL_PAGE" : null
  ].filter(Boolean) as DocumentQualityIssue[];
}

export function assessDocumentQuality(input: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  extraction?: ExtractionSummary;
  maxBytes?: number;
}): DocumentQualityResult {
  const issues = new Set<DocumentQualityIssue>();
  const warnings: string[] = [];
  const dimensions = imageDimensions(input.bytes, input.mimeType) ?? undefined;
  const isImage = input.mimeType.startsWith("image/");
  const isPdf = input.mimeType.includes("pdf");

  if (!supportedMimeTypes.has(input.mimeType)) issues.add("UNSUPPORTED_FILE_TYPE");
  if (input.maxBytes && input.bytes.length > input.maxBytes) issues.add("FILE_TOO_LARGE");
  if (input.bytes.length < 512) issues.add("FILE_TOO_SMALL");
  for (const issue of issuesFromNameAndMarkers(input.bytes, input.fileName)) issues.add(issue);

  if (isImage) {
    if (!dimensions) {
      issues.add("LOW_RESOLUTION");
    } else if (dimensions.width < 900 || dimensions.height < 600) {
      issues.add("LOW_RESOLUTION");
    }
    if (input.extraction && input.extraction.model === "image-no-ocr") {
      issues.add("IMAGE_OCR_NOT_CONFIGURED");
    }
  }

  if ((isImage || isPdf) && (input.extraction?.confidence ?? 0) < 0.35 && !(input.extraction?.extractedTextPreview ?? "").trim()) {
    issues.add("UNREADABLE_TEXT");
  }

  if (issues.has("UNSUPPORTED_FILE_TYPE")) warnings.push("Unsupported file type. Upload PDF, JPG, PNG, or WEBP evidence only.");
  if (issues.has("LOW_RESOLUTION")) warnings.push("Image resolution is low or could not be read reliably.");
  if (issues.has("BLURRY_IMAGE")) warnings.push("Image appears blurry from filename/quality marker and needs manual review.");
  if (issues.has("GLARE_OR_REFLECTION")) warnings.push("Glare/reflection was flagged. Ask for a clearer photo if key fields are affected.");
  if (issues.has("CROPPED_DOCUMENT") || issues.has("MISSING_CORNERS") || issues.has("PARTIAL_PAGE")) warnings.push("The document may be cropped or partial. All corners and full page should be visible.");
  if (issues.has("ROTATED_OR_SKEWED")) warnings.push("The photo appears rotated/skewed and may reduce OCR accuracy.");
  if (issues.has("MULTIPLE_DOCUMENTS")) warnings.push("Multiple documents in one image can reduce field matching accuracy.");
  if (issues.has("IMAGE_OCR_NOT_CONFIGURED")) warnings.push("Image OCR is not configured. Store securely, but require review or re-upload before autofill.");
  if (issues.has("UNREADABLE_TEXT")) warnings.push("No readable text was extracted. Re-upload or manual review is required.");
  for (const warning of input.extraction?.warnings ?? []) warnings.push(warning);

  const explicitStatus = explicitQualityMarker(input.bytes);
  let score = 0.9;
  if ((input.extraction?.confidence ?? 0) > 0) score = Math.min(score, Math.max(0.1, input.extraction?.confidence ?? 0.1));
  score -= issues.has("FILE_TOO_SMALL") ? 0.2 : 0;
  score -= issues.has("LOW_RESOLUTION") ? 0.25 : 0;
  score -= issues.has("BLURRY_IMAGE") ? 0.25 : 0;
  score -= issues.has("GLARE_OR_REFLECTION") ? 0.18 : 0;
  score -= issues.has("CROPPED_DOCUMENT") || issues.has("MISSING_CORNERS") || issues.has("PARTIAL_PAGE") ? 0.22 : 0;
  score -= issues.has("IMAGE_OCR_NOT_CONFIGURED") ? 0.35 : 0;
  score -= issues.has("UNREADABLE_TEXT") ? 0.35 : 0;
  score = Math.max(0, Math.min(1, score));

  const issueList = [...issues];
  const computedStatus: DocumentQualityStatus =
    issues.has("UNSUPPORTED_FILE_TYPE") || issues.has("UNREADABLE_TEXT")
      ? "UNREADABLE_REUPLOAD_REQUIRED"
      : score < 0.45 || issues.has("IMAGE_OCR_NOT_CONFIGURED")
        ? "POOR_QUALITY_REUPLOAD_RECOMMENDED"
        : score < 0.75 || issueList.length
          ? "ACCEPTABLE_WITH_REVIEW"
          : "GOOD_QUALITY";
  const status = explicitStatus ?? computedStatus;
  const finalScore = explicitStatus === "GOOD_QUALITY"
    ? Math.max(score, 0.9)
    : explicitStatus === "ACCEPTABLE_WITH_REVIEW"
      ? Math.min(Math.max(score, 0.62), 0.74)
      : explicitStatus === "POOR_QUALITY_REUPLOAD_RECOMMENDED"
        ? Math.min(score, 0.44)
        : explicitStatus === "UNREADABLE_REUPLOAD_REQUIRED"
          ? Math.min(score, 0.25)
          : score;

  return {
    status,
    score: finalScore,
    issues: issueList,
    warnings,
    reuploadMessage: status === "GOOD_QUALITY"
      ? undefined
      : "Please upload a clearer scan or photo. Make sure all corners are visible, text is sharp, and there is no glare.",
    dimensions,
    autofillCriticalFieldsAllowed: status === "GOOD_QUALITY" || status === "ACCEPTABLE_WITH_REVIEW",
    agentOverrideRequired: status === "POOR_QUALITY_REUPLOAD_RECOMMENDED" || status === "UNREADABLE_REUPLOAD_REQUIRED"
  };
}

export function isCriticalExtractionFieldKey(fieldKey: string) {
  return /passport|date_of_birth|dob|grant|coe|english|score|policy|provider|fund|balance|skill|assessment|outcome|marriage|relationship|sponsor|employer|abn|acn|expiry|issue/i.test(fieldKey);
}
