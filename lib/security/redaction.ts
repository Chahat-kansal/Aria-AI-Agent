function redactString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 4) return "[redacted]";
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

const sensitiveKeys = [
  "token",
  "password",
  "secret",
  "passport",
  "dob",
  "dateofbirth",
  "birth",
  "address",
  "answer",
  "documenttext",
  "documenturl",
  "extractedtext",
  "filename",
  "fieldvalue",
  "grant",
  "snippet",
  "portal",
  "notes",
  "content",
  "questionnaire",
  "email",
  "phone",
  "rawurl",
  "response",
  "source",
  "storagekey",
  "submission",
  "url"
];

function isSensitiveKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return sensitiveKeys.some((candidate) => normalized.includes(candidate));
}

export function redactSensitive(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key)
          ? redactSensitiveLeaf(item)
          : redactSensitive(item)
      ])
    );
  }
  return "[redacted]";
}

function redactSensitiveLeaf(value: unknown) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  const serialized = JSON.stringify(value);
  return typeof serialized === "string" ? redactString(serialized) : "[redacted]";
}

export function redactAuditMetadata<T>(value: T): T {
  return redactSensitive(value) as T;
}
