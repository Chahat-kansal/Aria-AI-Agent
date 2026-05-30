import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getCalendarProviderName } from "@/lib/providers/calendar-provider";
import { handleCalendarOAuthCallback } from "@/lib/services/calendar/calendar-oauth";
import { resolveCalendarOAuthCallbackState } from "@/lib/services/calendar/calendar-integration";

export async function GET(request: Request) {
  const context = await requireCurrentWorkspaceContext();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = await resolveCalendarOAuthCallbackState(url.searchParams.get("state"));
  const provider = getCalendarProviderName();

  if (!code || !state || state.workspaceId !== context.workspace.id || state.userId !== context.user.id || state.provider !== provider) {
    return NextResponse.redirect(new URL("/app/settings/integrations/calendar?status=invalid_state", request.url));
  }

  const result = await handleCalendarOAuthCallback({
    workspaceId: context.workspace.id,
    userId: context.user.id,
    provider,
    selectedCalendarId: state.selectedCalendarId || null,
    code
  });

  const nextUrl = new URL("/app/settings/integrations/calendar", request.url);
  nextUrl.searchParams.set("status", result.ok ? "connected" : "failed");
  return NextResponse.redirect(nextUrl);
}
