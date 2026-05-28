function normalizeSecret(value?: string | null) {
  return (value || "").trim();
}

export function hasConfiguredSecret(value?: string | null) {
  const normalized = normalizeSecret(value).toLowerCase();
  if (!normalized) return false;
  return ![
    "replace-with-strong-secret",
    "replace-me",
    "replace_me",
    "sk-replace-me",
    "sk_test_replace_me",
    "pk_test_replace_me",
    "whsec_replace_me",
    "change-me",
    "placeholder",
    "test-placeholder",
    "your-key-here"
  ].some((placeholder) => normalized.includes(placeholder));
}

export function hasConfiguredValue(value?: string | null) {
  return Boolean(normalizeSecret(value));
}

export function redactErrorSummary(value?: string | null) {
  if (!value) return null;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]")
    .replace(/pk_[A-Za-z0-9_-]+/g, "pk_[redacted]")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .slice(0, 180);
}
