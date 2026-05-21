const SENSITIVE_PATTERNS = [
  /\b(prisma|sql|database|postgres|sqlite|mysql)\b/i,
  /\b(openai|anthropic|aws|textract|vercel|blob|supabase|resend)\b/i,
  /\b(token|secret|api[_ -]?key|service[_ -]?role|nextauth|cron_secret|app_field_encryption_key)\b/i,
  /\b(econn|enoent|eacces|etimedout|fetch failed|timed out|stack|trace)\b/i,
  /\b(file system|filesystem|path|directory)\b/i
];

const SAFE_MESSAGE_PATTERNS = [
  /\brequired\b/i,
  /\bnot found\b/i,
  /\bnot available\b/i,
  /\bnot configured\b/i,
  /\btoo large\b/i,
  /\bunsupported\b/i,
  /\bdisabled\b/i,
  /\bpermission\b/i,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\binvalid\b/i,
  /\bmissing\b/i,
  /\breview required\b/i,
  /\bscoped\b/i
];

function normalizeMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  return "";
}

export function isSensitiveErrorMessage(message: string) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

export function toPublicErrorMessage(error: unknown, fallback: string) {
  const message = normalizeMessage(error);
  if (!message) return fallback;
  if (SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message)) && !isSensitiveErrorMessage(message)) {
    return message;
  }
  return fallback;
}
