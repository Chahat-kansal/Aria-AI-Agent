import fs from "node:fs";
import path from "node:path";
import * as nextEnv from "@next/env";

type DbUrlSummary = {
  present: boolean;
  host: string | null;
  port: string | null;
  sslmodePresent: boolean;
};

let loaded = false;

function redactHost(value: string | null) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length <= 2) return value.replace(/^[^.]+/, "***");
  return ["***", ...parts.slice(1)].join(".");
}

function summarizeDbUrl(raw: string | undefined): DbUrlSummary {
  if (!raw?.trim()) {
    return { present: false, host: null, port: null, sslmodePresent: false };
  }

  try {
    const parsed = new URL(raw);
    const sslmodePresent = parsed.searchParams.has("sslmode");
    return {
      present: true,
      host: redactHost(parsed.hostname),
      port: parsed.port || (parsed.protocol === "postgresql:" ? "5432" : null),
      sslmodePresent
    };
  } catch {
    return {
      present: true,
      host: "unparseable",
      port: null,
      sslmodePresent: /sslmode=/i.test(raw)
    };
  }
}

export function loadScriptEnv() {
  if (!loaded) {
    nextEnv.loadEnvConfig(process.cwd());
    loaded = true;
  }
}

export function getEnvFilePresence() {
  const cwd = process.cwd();
  const files = [".env", ".env.local", ".env.production"] as const;
  return files.map((name) => ({
    name,
    present: fs.existsSync(path.join(cwd, name))
  }));
}

export function getRedactedEnvStatus() {
  loadScriptEnv();

  return {
    DATABASE_URL: summarizeDbUrl(process.env.DATABASE_URL),
    DIRECT_URL: summarizeDbUrl(process.env.DIRECT_URL),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    APP_FIELD_ENCRYPTION_KEY: Boolean(process.env.APP_FIELD_ENCRYPTION_KEY?.trim()),
    CRON_SECRET: Boolean(process.env.CRON_SECRET?.trim())
  };
}
