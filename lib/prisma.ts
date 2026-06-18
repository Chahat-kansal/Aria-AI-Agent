import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function resolveRuntimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
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
