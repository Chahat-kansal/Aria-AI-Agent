export function serverLog(event: string, details: Record<string, unknown> = {}) {
  console.error(`[aria:${event}]`, {
    at: new Date().toISOString(),
    ...details
  });
}

function hasConfiguredSecret(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "replace-with-strong-secret",
    "replace-me",
    "replace_me",
    "sk-replace-me",
    "sk_test_replace_me",
    "pk_test_replace_me",
    "whsec_replace_me",
    "vercel_blob_replace_me"
  ].some((placeholder) => normalized.includes(placeholder));
}

export function getBaseUrl() {
  return (process.env.NEXTAUTH_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` || "").replace(/\/$/, "");
}

export function getAuthConfigStatus() {
  const missing = [];
  if (!process.env.NEXTAUTH_URL && !process.env.VERCEL_URL) missing.push("NEXTAUTH_URL");
  if (!hasConfiguredSecret(process.env.NEXTAUTH_SECRET)) missing.push("NEXTAUTH_SECRET");
  return { configured: missing.length === 0, missing };
}

export function getDatabaseConfigStatus() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  return { configured: missing.length === 0, missing };
}

export function getAiConfigStatus() {
  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  const hasOpenAi = hasConfiguredSecret(process.env.OPENAI_API_KEY);
  const hasAnthropic = hasConfiguredSecret(process.env.ANTHROPIC_API_KEY);
  const configured = provider === "anthropic" ? hasAnthropic : provider === "openai" ? hasOpenAi : hasOpenAi || hasAnthropic;
  return {
    configured,
    provider: provider || (hasOpenAi ? "openai" : hasAnthropic ? "anthropic" : "not configured"),
    missing: configured ? [] : ["OPENAI_API_KEY or ANTHROPIC_API_KEY"]
  };
}

export function getOcrConfigStatus() {
  const provider = (process.env.DOCUMENT_AI_PROVIDER || "basic").toLowerCase();
  const configured = provider === "basic"
    || (
      provider === "aws-textract"
      && Boolean(process.env.AWS_ACCESS_KEY_ID)
      && Boolean(process.env.AWS_SECRET_ACCESS_KEY)
      && Boolean(process.env.AWS_REGION)
    );

  return {
    configured,
    provider,
    missing: configured ? [] : provider === "aws-textract"
      ? ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]
      : ["DOCUMENT_AI_PROVIDER"]
  };
}

export function getEmailConfigStatus() {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const configured = provider === "resend" && hasConfiguredSecret(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM);
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
    (provider === "vercel-blob" && hasConfiguredSecret(process.env.BLOB_READ_WRITE_TOKEN));
  return {
    configured,
    provider,
    missing: configured ? [] : provider === "local" ? ["production-safe storage provider"] : ["BLOB_READ_WRITE_TOKEN"]
  };
}

export function getWebResearchConfigStatus() {
  const provider = (process.env.WEB_RESEARCH_PROVIDER || "").toLowerCase();
  const configured =
    (provider === "tavily" && hasConfiguredSecret(process.env.TAVILY_API_KEY)) ||
    (provider === "firecrawl" && hasConfiguredSecret(process.env.FIRECRAWL_API_KEY)) ||
    (!provider && (hasConfiguredSecret(process.env.TAVILY_API_KEY) || hasConfiguredSecret(process.env.FIRECRAWL_API_KEY)));

  return {
    configured,
    provider: provider || "not configured",
    missing: configured ? [] : ["WEB_RESEARCH_PROVIDER plus provider API key"]
  };
}

export function getEmbeddingsConfigStatus() {
  const provider = (process.env.EMBEDDINGS_PROVIDER || "").toLowerCase();
  const configured = provider === "openai" && hasConfiguredSecret(process.env.OPENAI_API_KEY);
  return {
    configured,
    provider: provider || "keyword fallback",
    missing: configured ? [] : provider ? ["OPENAI_API_KEY"] : ["EMBEDDINGS_PROVIDER=openai", "OPENAI_API_KEY"]
  };
}

export function getCronConfigStatus() {
  const configured = hasConfiguredSecret(process.env.CRON_SECRET);
  return {
    configured,
    provider: configured ? "secret protected" : "not configured",
    missing: configured ? [] : ["CRON_SECRET"]
  };
}

export function getEncryptionConfigStatus() {
  const configured = hasConfiguredSecret(process.env.APP_FIELD_ENCRYPTION_KEY);
  return {
    configured,
    provider: configured ? "application field encryption" : "not configured",
    missing: configured ? [] : ["APP_FIELD_ENCRYPTION_KEY"]
  };
}

export function getUploadLimits() {
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 15);
  return {
    maxBytes: Math.max(1, maxMb) * 1024 * 1024,
    maxMb: Math.max(1, maxMb)
  };
}
