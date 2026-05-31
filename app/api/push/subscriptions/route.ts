import { NextRequest, NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getPushProviderRouter } from "@/lib/services/push/push-provider-router";

export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const body = await request.json();
    const result = await getPushProviderRouter().registerDevice({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      deviceId: String(body.deviceId || "").trim(),
      endpoint: String(body.endpoint || "").trim(),
      subscriptionJson: String(body.subscriptionJson || "").trim(),
      platform: typeof body.platform === "string" ? body.platform : null,
      userAgent: typeof body.userAgent === "string" ? body.userAgent : null
    });
    return NextResponse.json({ ok: result.ok, message: result.reason });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Push registration failed." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const body = await request.json();
    const result = await getPushProviderRouter().unregisterDevice({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      deviceId: String(body.deviceId || "").trim()
    });
    return NextResponse.json({ ok: result.ok, message: result.reason }, { status: result.ok ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Push unregistration failed." },
      { status: 400 }
    );
  }
}
