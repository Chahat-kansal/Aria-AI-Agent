import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function normalizePostgresUrl(raw: string | undefined) {
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const isSupabasePooler = host.includes("pooler.supabase.com");

    if (isSupabasePooler && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    return parsed.toString();
  } catch {
    return raw;
  }
}

function resolveRuntimeDatabaseUrl() {
  const allowDirectRuntime =
    process.env.PRISMA_RUNTIME_USE_DIRECT_URL === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.DIRECT_URL;
  return normalizePostgresUrl(allowDirectRuntime || process.env.DATABASE_URL || process.env.DIRECT_URL);
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: resolveRuntimeDatabaseUrl()
          }
        }
      : undefined
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
