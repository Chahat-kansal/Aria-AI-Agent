import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingPlan } from "@prisma/client";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import {
  canManageWorkspaceBilling,
  canViewWorkspaceBilling,
  cancelWorkspaceSubscription,
  createWorkspaceCheckoutSession,
  createWorkspaceCustomerPortalSession,
  getWorkspaceBillingSnapshot
} from "@/lib/services/payments/workspace-subscriptions";

function formatDate(value?: Date | null) {
  return value ? value.toLocaleString("en-AU") : "Not recorded";
}

export default async function BillingSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canViewWorkspaceBilling(context.user)) {
    return (
      <AppShell title="Billing">
        <PageHeader title="Billing unavailable" description="Workspace billing is limited to company billing roles." />
      </AppShell>
    );
  }

  const snapshot = await getWorkspaceBillingSnapshot(context.workspace.id);
  const canManage = canManageWorkspaceBilling(context.user);

  async function startCheckout(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageWorkspaceBilling(context.user)) return;
    const plan = String(formData.get("plan") || "STARTER") as BillingPlan;
    const result = await createWorkspaceCheckoutSession({
      workspaceId: context.workspace.id,
      workspaceName: context.workspace.name,
      billingEmail: context.workspace.contactEmail || context.user.email,
      plan,
      userId: context.user.id
    });
    revalidatePath("/app/settings/billing");
    revalidatePath("/app/settings/integrations/payments");
    if (result.url) redirect(result.url);
  }

  async function openBillingPortal() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageWorkspaceBilling(context.user)) return;
    const result = await createWorkspaceCustomerPortalSession({
      workspaceId: context.workspace.id,
      userId: context.user.id
    });
    revalidatePath("/app/settings/billing");
    if (result.url) redirect(result.url);
  }

  async function cancelSubscriptionAction() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageWorkspaceBilling(context.user)) return;
    await cancelWorkspaceSubscription({
      workspaceId: context.workspace.id,
      userId: context.user.id
    });
    revalidatePath("/app/settings/billing");
    revalidatePath("/admin/billing");
  }

  const currentPlan = snapshot.workspace?.billingPlan ?? null;
  const currentStatus = snapshot.workspace?.subscriptionStatus ?? "NOT_CONFIGURED";

  return (
    <AppShell title="Billing">
      <div className="space-y-6">
        <PageHeader
          eyebrow="BILLING"
          title="Workspace subscription billing"
          description="Aria subscription billing and optional invoice payments are kept separate. Card and payment method details are not stored or shown here."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Current subscription</h2>
                <p className="mt-1 text-sm text-slate-400">{snapshot.provider.providerName}</p>
              </div>
              <StatusPill tone={snapshot.provider.configured ? "success" : snapshot.provider.state === "disabled" ? "neutral" : "warning"}>
                {snapshot.provider.state === "disabled" ? "Disabled" : snapshot.provider.configured ? "Configured" : "Needs setup"}
              </StatusPill>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <p>Plan: <span className="text-white">{currentPlan ?? "Not configured"}</span></p>
              <p>Status: <span className="text-white">{currentStatus.replaceAll("_", " ")}</span></p>
              <p>Trial ends: <span className="text-white">{formatDate(snapshot.workspace?.trialEndsAt)}</span></p>
              <p>Current period end: <span className="text-white">{formatDate(snapshot.workspace?.currentPeriodEnd)}</span></p>
              <p>Billing email: <span className="text-white">{snapshot.workspace?.billingEmail || snapshot.workspace?.contactEmail || "Not recorded"}</span></p>
              <p>Last webhook: <span className="text-white">{snapshot.latestWebhook ? snapshot.latestWebhook.createdAt.toLocaleString("en-AU") : "Not recorded"}</span></p>
            </div>
            {currentStatus === "PAST_DUE" || currentStatus === "UNPAID" ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                Payment attention required. Review billing status in Stripe before treating the workspace subscription as active.
              </div>
            ) : null}
            {canManage ? (
              <div className="flex flex-wrap gap-3">
                <form action={openBillingPortal}>
                  <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                    Manage billing
                  </button>
                </form>
                <form action={cancelSubscriptionAction}>
                  <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                    Cancel at period end
                  </button>
                </form>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Provider readiness</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Publishable key: <span className="text-white">{snapshot.env.publishableKeyPresent ? "Present" : "Missing"}</span></p>
              <p>Webhook secret: <span className="text-white">{snapshot.env.webhookSecretPresent ? "Present" : "Missing"}</span></p>
              <p>Starter price: <span className="text-white">{snapshot.env.priceIdsPresent.starter ? "Present" : "Missing"}</span></p>
              <p>Pro price: <span className="text-white">{snapshot.env.priceIdsPresent.pro ? "Present" : "Missing"}</span></p>
              <p>Team price: <span className="text-white">{snapshot.env.priceIdsPresent.team ? "Present" : "Missing"}</span></p>
            </div>
            <p className="text-xs leading-6 text-slate-400">
              Stripe metadata is limited to workspace billing references. No client names, visa details, document names, or payment method data are sent or shown here.
            </p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {snapshot.planCatalog.map((planCard) => (
            <Card key={planCard.plan} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{planCard.label}</h2>
                  <p className="mt-1 text-sm text-slate-400">{planCard.description}</p>
                </div>
                <StatusPill tone={currentPlan === planCard.plan ? "info" : "neutral"}>
                  {currentPlan === planCard.plan ? "Current" : "Available"}
                </StatusPill>
              </div>
              <p className="text-sm text-slate-300">{planCard.workspaceSummary}</p>
              {canManage ? (
                <form action={startCheckout}>
                  <input type="hidden" name="plan" value={planCard.plan} />
                  <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                    Choose {planCard.label}
                  </button>
                </form>
              ) : null}
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
