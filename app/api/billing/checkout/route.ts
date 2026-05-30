import { NextResponse } from "next/server";
import { BillingPlan } from "@prisma/client";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageWorkspaceBilling } from "@/lib/services/payments/workspace-subscriptions";
import { getPaymentProviderRouter } from "@/lib/services/payments/payment-provider-router";
import { auditAccessDenied } from "@/lib/services/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  plan: z.nativeEnum(BillingPlan)
});

export async function POST(req: Request) {
  try {
    const limit = enforceRateLimit(req, {
      action: "billing.checkout",
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
        reason: "checkout_requires_workspace_billing_permission"
      });
      return NextResponse.json({ error: "Workspace billing is limited to company billing roles." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid billing plan is required." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const result = await getPaymentProviderRouter().createCheckoutSession({
      workspaceId: context.workspace.id,
      workspaceName: context.workspace.name,
      billingEmail: context.workspace.contactEmail || context.user.email,
      plan: parsed.data.plan,
      userId: context.user.id
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    serverLog("billing.checkout_route_error", { reason: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Unable to create a billing checkout session right now." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
