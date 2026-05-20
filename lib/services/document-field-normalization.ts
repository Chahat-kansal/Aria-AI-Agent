export type NormalizedExtractedField = {
  key: string;
  originalValue: string;
  normalizedValue: string;
  redactedDisplayValue: string;
  confidence?: number;
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDateValue(value: string) {
  const trimmed = compactWhitespace(value);
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const match = trimmed.match(/\b(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-z]{3,9})[\/\-. ](\d{2,4})\b/);
  if (!match) return trimmed.toLowerCase();
  const monthText = match[2].toLowerCase();
  const months: Record<string, string> = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04",
    may: "05", jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09",
    september: "09", oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12"
  };
  const day = match[1].padStart(2, "0");
  const month = months[monthText] ?? match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

function normalizeCurrencyValue(value: string) {
  const amount = value.match(/(?:AUD|A\$|\$)?\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i)?.[1];
  if (!amount) return compactWhitespace(value).toLowerCase();
  return Number(amount.replace(/[,\s]/g, "")).toFixed(2);
}

function normalizeScoreValue(value: string) {
  const score = value.match(/\d+(?:\.\d+)?/)?.[0];
  return score ? String(Number(score)) : compactWhitespace(value).toLowerCase();
}

function normalizeIdentifier(value: string) {
  return compactWhitespace(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function normalizePhone(value: string) {
  return compactWhitespace(value).replace(/[^\d+]/g, "");
}

function normalizeAddress(value: string) {
  return compactWhitespace(value).replace(/[,.]+/g, "").toLowerCase();
}

export function normalizeExtractedValue(key: string, value: string) {
  const lowerKey = key.toLowerCase();
  const trimmed = compactWhitespace(value);
  if (!trimmed) return "";
  if (/date|dob|expiry|issued|grant_date|completion/.test(lowerKey)) return normalizeDateValue(trimmed);
  if (/passport|grant|policy|coe|reference|abn|acn|anzsco/.test(lowerKey)) return normalizeIdentifier(trimmed);
  if (/fund|balance|salary|amount|currency/.test(lowerKey)) return normalizeCurrencyValue(trimmed);
  if (/score|listening|reading|writing|speaking|overall/.test(lowerKey)) return normalizeScoreValue(trimmed);
  if (/phone|mobile/.test(lowerKey)) return normalizePhone(trimmed);
  if (/address/.test(lowerKey)) return normalizeAddress(trimmed);
  return trimmed.toLowerCase();
}

export function redactExtractedDisplayValue(key: string, value: string) {
  const normalized = compactWhitespace(value);
  if (!normalized) return "";
  if (/passport|grant|policy|reference|abn|acn/i.test(key)) {
    return normalized.length <= 4 ? "[REDACTED]" : `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  }
  if (/date_of_birth|dob/i.test(key)) return "[DOB REDACTED]";
  if (/email/i.test(key)) return normalized.replace(/^(.).+(@.+)$/, "$1***$2");
  if (/phone/i.test(key)) return normalized.length <= 4 ? "[PHONE REDACTED]" : `***${normalized.slice(-4)}`;
  if (/address/i.test(key)) return "[ADDRESS REDACTED]";
  return normalized;
}

export function normalizeExtractedKeyValues(
  keyValues: Array<{ key: string; value: string; confidence?: number }> = []
): NormalizedExtractedField[] {
  return keyValues
    .filter((field) => field.key && field.value)
    .map((field) => ({
      key: field.key,
      originalValue: compactWhitespace(field.value),
      normalizedValue: normalizeExtractedValue(field.key, field.value),
      redactedDisplayValue: redactExtractedDisplayValue(field.key, field.value),
      confidence: field.confidence
    }));
}

export function normalizedValuesMatch(key: string, actual: string | undefined | null, expected: string | undefined | null) {
  if (actual == null || expected == null) return false;
  return normalizeExtractedValue(key, actual) === normalizeExtractedValue(key, expected);
}
