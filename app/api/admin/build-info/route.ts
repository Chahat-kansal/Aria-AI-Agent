import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/services/platform-admin";
import { getBuildInfoSummary } from "@/lib/services/platform-admin-data";

export async function GET() {
  await requirePlatformAdmin();
  const buildInfo = await getBuildInfoSummary();
  return NextResponse.json({
    app: "Aria Migration SaaS",
    root: buildInfo.root,
    environment: buildInfo.environment,
    commit: buildInfo.commit,
    vercelUrl: buildInfo.vercelUrl,
    runtime: {
      aiConfigured: buildInfo.aiConfigured,
      cronConfigured: buildInfo.cronConfigured,
      encryptionConfigured: buildInfo.encryptionConfigured
    }
  }, { headers: { "Cache-Control": "private, no-store" } });
}
