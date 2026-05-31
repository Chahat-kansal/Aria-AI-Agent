import { NextResponse } from "next/server";
import { handleCloudDriveOAuthCallback, decodeCloudDriveOAuthState } from "@/lib/services/cloud-drive/cloud-drive-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const resolved = decodeCloudDriveOAuthState(state);

  if (!code || !resolved) {
    return NextResponse.redirect(new URL("/app/settings/integrations/cloud-drive?status=invalid_callback", request.url));
  }

  await handleCloudDriveOAuthCallback({
    ...resolved,
    code
  });

  return NextResponse.redirect(new URL("/app/settings/integrations/cloud-drive?status=connected", request.url));
}
