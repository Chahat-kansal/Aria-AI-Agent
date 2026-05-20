import { NextResponse } from "next/server";
import { serverLog } from "@/lib/services/runtime-config";
import { getRequestIp } from "@/lib/security/rate-limit";

function configuredCronSecret() {
  return process.env.CRON_SECRET?.trim().replace(/^['"]|['"]$/g, "") || "";
}

export function getCronAuthFailure(req: Request, route: string) {
  const secret = configuredCronSecret();
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  const hasBearer = Boolean(secret && auth === `Bearer ${secret}`);
  const hasHeader = Boolean(secret && headerSecret === secret);

  if (secret && (hasBearer || hasHeader)) {
    serverLog("cron.auth.allowed", {
      route,
      ip: getRequestIp(req),
      method: hasBearer ? "authorization" : "x-cron-secret"
    });
    return null;
  }

  serverLog("cron.auth.denied", {
    route,
    ip: getRequestIp(req),
    reason: secret ? "missing_or_wrong_secret" : "cron_secret_missing",
    userAgentPresent: Boolean(req.headers.get("user-agent"))
  });

  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "Cache-Control": "private, no-store" }
    }
  );
}
