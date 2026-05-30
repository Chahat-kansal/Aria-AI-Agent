import { NextResponse } from "next/server";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageWorkspaceBilling } from "@/lib/services/payments/workspace-subscriptions";
import { getPaymentProviderRouter } from "@/lib/services/payments/payment-provider-router";
import { auditAccessDenied } from "@/lib/services/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { serverLog } from "@/lib/services/runtime-config";

export async function POST(req: Request) {
  try {
    const limit = enforceRateLimit(req, {
      action: "billing.portal",
      limit: 5,
      windowMs: 60_000
    });
    if (limit) return limit;

    const context = await requireCurrentWorkspaceContext();
    if (!canManageWorkspaceBilling(context.user)) {
      await auditAccessDenied({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        entityType: "Billing",
        entityId: context.workspace.id,
        reason: "customer_portal_requires_workspace_billing_permission"
      });
      return NextResponse.json({ error: "Workspace billing is limited to company billing roles." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    const result = await getPaymentProviderRouter().createCustomerPortalSession({
      workspaceId: context.workspace.id,
      userId: context.user.id
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    serverLog("billing.portal_route_error", { reason: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to open billing management right now." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
