import { getVisaSubclassDefinition, normalizeVisaSubclassCode, type VisaFieldDefinition } from "@/lib/services/visa-field-definitions";

export type DraftFieldCandidate = {
  key: string;
  value: string;
  confidence: number;
  snippet: string;
};

function cleanValue(value: string | undefined | null) {
  if (!value) return null;
  return value.replace(/\s+/g, " ").replace(/\s*[;,.]\s*$/, "").trim() || null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSnippet(text: string, pattern: RegExp, fallback: string) {
  const match = text.match(pattern);
  if (!match?.index && match?.index !== 0) return fallback;
  return text.slice(Math.max(0, match.index - 80), Math.min(text.length, match.index + 180)).trim() || fallback;
}

function extractLabelValue(text: string, labels: string[]) {
  for (const label of labels) {
    const inline = new RegExp(`\\b${escapeRegex(label)}\\s*[:\\-]\\s*([^\\n\\r]+)`, "i");
    const inlineMatch = text.match(inline);
    const inlineValue = cleanValue(inlineMatch?.[1]);
    if (inlineValue) return inlineValue;

    const nextLine = new RegExp(`\\b${escapeRegex(label)}\\s*[\\n\\r]+([^\\n\\r]+)`, "i");
    const nextLineMatch = text.match(nextLine);
    const nextLineValue = cleanValue(nextLineMatch?.[1]);
    if (nextLineValue) return nextLineValue;
  }
  return null;
}

function normalizeKeyValueLabel(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function coerceValue(field: VisaFieldDefinition, raw: string) {
  const value = cleanValue(raw);
  if (!value) return null;

  if (field.valueType === "CURRENCY") {
    const amount = value.match(/(?:AUD|A\$|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]{4,})/i)?.[1];
    return amount ? `AUD ${amount}` : value;
  }

  if (field.valueType === "BOOLEAN") {
    if (/^(yes|true|present|provided|completed)$/i.test(value)) return "true";
    if (/^(no|false|missing|not provided)$/i.test(value)) return "false";
    return "true";
  }

  return value;
}

export function inferSubclassFieldCandidates(input: {
  subclassCode: string;
  category?: string;
  fileName: string;
  extractedText?: string;
  keyValues?: Array<{ key: string; value: string; confidence?: number }>;
}) {
  const definition = getVisaSubclassDefinition(normalizeVisaSubclassCode(input.subclassCode));
  const text = input.extractedText ?? "";
  const keyValues = (input.keyValues ?? []).map((item) => ({
    key: normalizeKeyValueLabel(item.key),
    value: cleanValue(item.value) ?? "",
    confidence: typeof item.confidence === "number" ? item.confidence : 0.9
  })).filter((item) => item.value);
  const summary = keyValues.map((item) => `${item.key}: ${item.value}`).join("\n");
  const candidates = new Map<string, DraftFieldCandidate>();
  const category = input.category?.trim();

  for (const field of definition.sections.flatMap((section) => section.fields)) {
    if (category && field.supportedDocumentCategories.length && !field.supportedDocumentCategories.includes(category)) {
      continue;
    }
    let fromKeyValue = keyValues.find((item) =>
      field.aliases.some((alias) => item.key.includes(normalizeKeyValueLabel(alias)))
    );
    const textValue = extractLabelValue(text, field.aliases);
    const raw = fromKeyValue?.value ?? textValue;
    const value = raw ? coerceValue(field, raw) : null;
    if (!value) continue;
    candidates.set(field.fieldKey, {
      key: field.fieldKey,
      value,
      confidence: Math.max(fromKeyValue?.confidence ?? 0.9, textValue ? 0.92 : 0.88),
      snippet: findSnippet(summary || text, new RegExp(field.aliases.map(escapeRegex).join("|"), "i"), `${field.label} evidence from ${input.fileName}`)
    });
  }

  return [...candidates.values()];
}
