export function redactMonitoringPayload(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/\b[A-Z]\d{6,}\b/g, "[redacted-passport]")
      .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[redacted-date]")
      .replace(/\bGR\s*\d+\b/gi, "[redacted-grant]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]");
  }
  if (Array.isArray(value)) return value.map((item) => redactMonitoringPayload(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (/passport|dob|grant|token|tokenhash|document|snippet|prompt|response|note|url|storagekey/.test(normalized)) {
          return [key, "[redacted]"];
        }
        return [key, redactMonitoringPayload(item)];
      })
    );
  }
  return value;
}
