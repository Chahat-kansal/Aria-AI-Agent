import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceBillingSnapshot, buildWorkspaceCheckoutDryRun } from "@/lib/services/payments/workspace-subscriptions";
import { getPaymentProviderRouter } from "@/lib/services/payments/payment-provider-router";
import { BillingPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export default async function PaymentsIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Payments integration">
        <PageHeader title="Payments integration unavailable" description="Your company administrator manages Stripe billing setup." />
      </AppShell>
    );
  }

  const [snapshot, recentAudit] = await Promise.all([
    getWorkspaceBillingSnapshot(context.workspace.id),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: context.workspace.id,
        action: {
          in: [
            "billing.checkout_created",
            "billing.checkout_failed",
            "billing.customer_portal_created",
            "billing.subscription_created",
            "billing.subscription_updated",
            "billing.subscription_cancelled",
            "billing.payment_succeeded",
            "billing.payment_failed",
            "billing.webhook_received",
            "billing.webhook_rejected",
            "billing.invoice_payment_link_created",
            "billing.invoice_payment_succeeded",
            "billing.invoice_payment_failed"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  const checkoutPreview = getPaymentProviderRouter().dryRunCheckoutPayload({
    workspaceId: context.workspace.id,
    workspaceName: context.workspace.name,
    billingEmail: context.workspace.contactEmail || context.user.email,
    plan: BillingPlan.STARTER
  });

  return (
    <AppShell title="Payments integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="PAYMENTS"
          title="Stripe billing integration"
          description="Workspace subscription billing and optional invoice payment links are managed here. Card and payment method details are never stored or displayed in Aria."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{snapshot.provider.providerName}</p>
              </div>
              <StatusPill tone={snapshot.provider.configured ? "success" : snapshot.provider.state === "disabled" ? "neutral" : "warning"}>
                {snapshot.provider.state === "disabled" ? "Disabled" : snapshot.provider.configured ? "Configured" : "Not configured"}
              </StatusPill>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Publishable key: <span className="text-white">{snapshot.env.publishableKeyPresent ? "Present" : "Missing"}</span></p>
              <p>Webhook secret: <span className="text-white">{snapshot.env.webhookSecretPresent ? "Present" : "Missing"}</span></p>
              <p>Starter price ID: <span className="text-white">{snapshot.env.priceIdsPresent.starter ? "Present" : "Missing"}</span></p>
              <p>Pro price ID: <span className="text-white">{snapshot.env.priceIdsPresent.pro ? "Present" : "Missing"}</span></p>
              <p>Team price ID: <span className="text-white">{snapshot.env.priceIdsPresent.team ? "Present" : "Missing"}</span></p>
              <p>Last webhook event: <span className="text-white">{snapshot.latestWebhook ? snapshot.latestWebhook.eventType : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{snapshot.provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
            </div>
            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {snapshot.provider.requiredSetupSteps.map((step) => <li key={step}>{step}</li>)}
              {snapshot.provider.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Recent billing audit</h2>
            <div className="space-y-3">
              {recentAudit.length ? recentAudit.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No billing integration events have been recorded yet.</p>}
            </div>
          </Card>
        </section>

        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Dry-run checkout payload preview</h2>
            <p className="mt-1 text-sm text-slate-400">Safe metadata only. This preview does not claim a live Stripe checkout session was created.</p>
          </div>
          <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">
            {JSON.stringify(checkoutPreview, null, 2)}
          </pre>
        </Card>
      </div>
    </AppShell>
  );
}
