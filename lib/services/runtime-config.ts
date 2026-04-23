export function serverLog(event: string, details: Record<string, unknown> = {}) {
  console.error(`[aria:${event}]`, {
    at: new Date().toISOString(),
    ...details
  });
}

export function getBaseUrl() {
  return (process.env.NEXTAUTH_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` || "").replace(/\/$/, "");
}

export function getAuthConfigStatus() {
  const missing = [];
  if (!process.env.NEXTAUTH_URL && !process.env.VERCEL_URL) missing.push("NEXTAUTH_URL");
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === "replace-with-strong-secret") missing.push("NEXTAUTH_SECRET");
  return { configured: missing.length === 0, missing };
}

export function getDatabaseConfigStatus() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  return { configured: missing.length === 0, missing };
}

export function getAiConfigStatus() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const configured = provider === "anthropic" ? hasAnthropic : provider === "openai" ? hasOpenAi : hasOpenAi || hasAnthropic;
  return {
    configured,
    provider: provider || (hasOpenAi ? "openai" : hasAnthropic ? "anthropic" : "not configured"),
    missing: configured ? [] : ["OPENAI_API_KEY or ANTHROPIC_API_KEY"]
  };
}

export function getEmailConfigStatus() {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const configured = provider === "resend" && Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM);
  return {
    configured,
    provider: provider || "not configured",
    missing: configured ? [] : ["EMAIL_PROVIDER=resend", "RESEND_API_KEY", "EMAIL_FROM"]
  };
}

export function getStorageConfigStatus() {
  const provider = (process.env.STORAGE_PROVIDER || "database").toLowerCase();
  const production = process.env.NODE_ENV === "production";
  const configured =
    provider === "database" ||
    (!production && provider === "local") ||
    (provider === "vercel-blob" && Boolean(process.env.BLOB_READ_WRITE_TOKEN));
  return {
    configured,
    provider,
    missing: configured ? [] : provider === "local" ? ["production-safe storage provider"] : ["BLOB_READ_WRITE_TOKEN"]
  };
}

export function getUploadLimits() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 15);
  return {
    maxBytes: Math.max(1, maxMb) * 1024 * 1024,
    maxMb: Math.max(1, maxMb)
  };
}
