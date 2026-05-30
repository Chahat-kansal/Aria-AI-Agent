import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getEmailSyncProviderName } from "@/lib/providers/email-sync-provider";
import {
  handleEmailSyncOAuthCallback,
  decodeEmailSyncOAuthState
} from "@/lib/services/email-sync/email-sync-oauth";

export async function GET(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = decodeEmailSyncOAuthState(searchParams.get("state"));

  if (!code || !state) {
    return NextResponse.redirect(new URL("/app/settings/integrations/email-sync?status=invalid_state", req.url));
  }

  if (
    state.workspaceId !== context.workspace.id ||
    state.userId !== context.user.id ||
    state.provider !== getEmailSyncProviderName()
  ) {
    return NextResponse.redirect(new URL("/app/settings/integrations/email-sync?status=invalid_state", req.url));
  }

  const result = await handleEmailSyncOAuthCallback({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    provider: state.provider as "gmail" | "microsoft" | "disabled",
    code
  });

  return NextResponse.redirect(
    new URL(`/app/settings/integrations/email-sync?status=${result.ok ? "connected" : "failed"}`, req.url)
  );
}
