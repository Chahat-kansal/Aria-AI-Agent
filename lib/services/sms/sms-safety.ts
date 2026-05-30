import { resolveBaseUrl } from "@/lib/services/runtime-config";

const SENSITIVE_PATTERNS = [
  /\bpassport\b/i,
  /\bdate of birth\b/i,
  /\bdob\b/i,
  /\bgrant number\b/i,
  /\btrn\b/i,
  /\btokenhash\b/i,
  /\btoken hash\b/i,
  /\bhealth\b/i,
  /\bcharacter\b/i,
  /\brefusal\b/i,
  /\bcancellation\b/i,
  /\bbank\b/i,
  /\bfinancial\b/i
];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildSafePortalLoginUrl() {
  const baseUrl = resolveBaseUrl();
  return baseUrl ? `${baseUrl}/client/login` : "/client/login";
}

export function isSafeSmsUrl(url?: string | null) {
  if (!url) return false;
  if (/[?#]/.test(url)) return false;
  return url.endsWith("/client/login") || url.endsWith("/client/portal");
}

export function sanitizeSmsBody(body: string) {
  return normalizeSpaces(body).slice(0, 320);
}

export function containsSensitiveSmsContent(body: string) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(body));
}

export function assertSafeSmsBody(body: string) {
  const normalized = sanitizeSmsBody(body);
  if (containsSensitiveSmsContent(normalized)) {
    throw new Error("SMS body contains sensitive content and must stay generic.");
  }
  if (/tokenHash|raw document|document url/i.test(normalized)) {
    throw new Error("SMS body must not include tokenHash or raw document URLs.");
  }
  return normalized;
}

export function validateSmsRecipient(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return { ok: false, normalized: null, reason: "Recipient phone number is required." };

  const digits = trimmed.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? digits
    : digits.startsWith("0")
      ? `+61${digits.slice(1)}`
      : `+${digits}`;

  const plainDigits = normalized.replace(/[^\d]/g, "");
  if (plainDigits.length < 8 || plainDigits.length > 15) {
    return { ok: false, normalized: null, reason: "Recipient phone number is not in a supported format." };
  }

  return { ok: true, normalized, reason: "ok" };
}
