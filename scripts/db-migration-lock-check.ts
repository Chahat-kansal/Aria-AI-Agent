import { prisma } from "@/lib/prisma";
import { getEnvFilePresence, getRedactedEnvStatus, loadScriptEnv } from "@/scripts/helpers/load-script-env";

type AdvisoryLockRow = {
  pid: number;
  usename: string | null;
  application_name: string | null;
  client_addr: string | null;
  state: string | null;
  query_start: Date | null;
  wait_event_type: string | null;
  wait_event: string | null;
  query_preview: string | null;
};

type PrismaMigrationRow = {
  migration_name: string;
  started_at: Date | null;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  logs: string | null;
};

function redactClientAddr(value: string | null) {
  if (!value) return null;
  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  }
  if (value.includes(":")) return "[redacted-ipv6]";
  return "[redacted-client-addr]";
}

function sanitizeQueryPreview(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\s+/g, " ")
    .replace(/'[^']*'/g, "'[redacted-literal]'")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .slice(0, 500);
}

function sanitizeMigrationLog(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/\b(?:sk|pk|whsec)_[A-Za-z0-9_-]+\b/g, "[redacted-secret]")
    .slice(0, 300);
}

async function main() {
  loadScriptEnv();

  const advisoryLocks = await prisma.$queryRawUnsafe<AdvisoryLockRow[]>(`
    SELECT
      l.pid,
      a.usename,
      a.application_name,
      host(a.client_addr)::text AS client_addr,
      a.state,
      a.query_start,
      a.wait_event_type,
      a.wait_event,
      left(a.query, 500) AS query_preview
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory'
    ORDER BY a.query_start ASC NULLS LAST
  `);

  const migrationRows = await prisma.$queryRawUnsafe<PrismaMigrationRow[]>(`
    SELECT migration_name, started_at, finished_at, rolled_back_at, logs
    FROM _prisma_migrations
    ORDER BY started_at DESC
    LIMIT 10
  `);

  const output = {
    files: getEnvFilePresence(),
    env: getRedactedEnvStatus(),
    advisoryLocks: advisoryLocks.map((row) => ({
      pid: row.pid,
      usename: row.usename,
      application_name: row.application_name,
      client_addr: redactClientAddr(row.client_addr),
      state: row.state,
      query_start: row.query_start?.toISOString() ?? null,
      wait_event_type: row.wait_event_type,
      wait_event: row.wait_event,
      query_preview: sanitizeQueryPreview(row.query_preview)
    })),
    prismaMigrations: migrationRows.map((row) => ({
      migration_name: row.migration_name,
      started_at: row.started_at?.toISOString() ?? null,
      finished_at: row.finished_at?.toISOString() ?? null,
      rolled_back_at: row.rolled_back_at?.toISOString() ?? null,
      logs_preview: sanitizeMigrationLog(row.logs)
    }))
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("[db-migration-lock-check]", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
