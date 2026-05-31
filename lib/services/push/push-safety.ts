const FORBIDDEN_PATTERN =
  /passport|date of birth|\bdob\b|grant number|\btrn\b|health|character|refusal|cancellation|financial|bank|tokenhash|raw document|document url|portal token|ai output|draft field|private notes/i;

export function assertSafePushText(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new Error("Push text cannot be empty.");
  if (FORBIDDEN_PATTERN.test(trimmed)) {
    throw new Error("Push text contains content that is not allowed in push notifications.");
  }
  if (/https?:\/\/.+(token|document|download|portal\/[A-Za-z0-9_-]+)/i.test(trimmed)) {
    throw new Error("Push text must not contain raw tokenized or document URLs.");
  }
  return trimmed.slice(0, 180);
}

export function assertSafePushRoute(route?: string | null) {
  if (!route) return null;
  const trimmed = route.trim();
  if (!trimmed.startsWith("/")) throw new Error("Push routes must stay inside the app.");
  if (/token|document|download|api|evidence-vault/i.test(trimmed)) {
    throw new Error("Push routes must not point directly to sensitive download, token, or API endpoints.");
  }
  return trimmed;
}

export function validatePushSubscriptionShape(subscriptionJson: string) {
  try {
    const parsed = JSON.parse(subscriptionJson) as Record<string, unknown>;
    return Boolean(
      parsed &&
      typeof parsed.endpoint === "string" &&
      typeof parsed.keys === "object" &&
      parsed.keys &&
      typeof (parsed.keys as Record<string, unknown>).p256dh === "string" &&
      typeof (parsed.keys as Record<string, unknown>).auth === "string"
    );
  } catch {
    return false;
  }
}
