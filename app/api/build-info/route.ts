import { NextResponse } from "next/server";
import { getAiConfigStatus, getCronConfigStatus, getEncryptionConfigStatus } from "@/lib/services/runtime-config";

export async function GET() {
  return NextResponse.json({
    app: "Aria Migration SaaS",
    root: "next-prisma-app",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    environment: process.env.VERCEL_ENV || "local",
    runtime: {
      aiConfigured: getAiConfigStatus().configured,
      cronConfigured: getCronConfigStatus().configured,
      encryptionConfigured: getEncryptionConfigStatus().configured
    }
  });
}
