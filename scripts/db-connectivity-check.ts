import { prisma } from "@/lib/prisma";
import { getEnvFilePresence, getRedactedEnvStatus, loadScriptEnv } from "@/scripts/helpers/load-script-env";

async function main() {
  loadScriptEnv();
  const files = getEnvFilePresence();
  const env = getRedactedEnvStatus();

  console.log(JSON.stringify({
    files,
    env: {
      DATABASE_URL: {
        present: env.DATABASE_URL.present,
        host: env.DATABASE_URL.host,
        port: env.DATABASE_URL.port,
        sslmode: env.DATABASE_URL.sslmodePresent ? "present" : "missing"
      },
      DIRECT_URL: {
        present: env.DIRECT_URL.present,
        host: env.DIRECT_URL.host,
        port: env.DIRECT_URL.port,
        sslmode: env.DIRECT_URL.sslmodePresent ? "present" : "missing"
      },
      NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ? "present" : "missing",
      APP_FIELD_ENCRYPTION_KEY: env.APP_FIELD_ENCRYPTION_KEY ? "present" : "missing",
      CRON_SECRET: env.CRON_SECRET ? "present" : "missing"
    }
  }, null, 2));

  if (!env.DATABASE_URL.present) {
    console.error("DATABASE_URL is missing. Check local env loading before running readiness scripts.");
    process.exit(1);
  }

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    await prisma.$disconnect();
    console.log("DB_CONNECTIVITY_OK");
  } catch (error) {
    await prisma.$disconnect().catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    console.error("DB_CONNECTIVITY_FAILED");
    console.error(message);
    console.error([
      "Troubleshooting hints:",
      "- Confirm DATABASE_URL host, port, and sslmode match the intended Supabase connection type.",
      "- Use DATABASE_URL for Prisma Client runtime and DIRECT_URL for direct Prisma operations.",
      "- If the host is correct, verify local network/firewall access to the Supabase pooler.",
      "- If running inside a restricted sandbox, rerun the check with network access."
    ].join("\n"));
    process.exit(1);
  }
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => {});
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
