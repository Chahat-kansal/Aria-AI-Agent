import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canViewWorkspaceBilling, getWorkspaceBillingSnapshot } from "@/lib/services/payments/workspace-subscriptions";
import { auditAccessDenied } from "@/lib/services/audit";
import { serverLog } from "@/lib/services/runtime-config";

export async function GET() {
  try {
    const context = await requireCurrentWorkspaceContext();
    if (!canViewWorkspaceBilling(context.user)) {
      await auditAccessDenied({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        entityType: "Billing",
        entityId: context.workspace.id,
        reason: "billing_status_requires_workspace_billing_permission"
      });
      return NextResponse.json({ error: "Workspace billing is limited to company billing roles." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    const snapshot = await getWorkspaceBillingSnapshot(context.workspace.id);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    serverLog("billing.status_route_error", { reason: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to load billing status right now." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
