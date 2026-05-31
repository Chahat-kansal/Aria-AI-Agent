import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PushDeviceManager } from "@/components/app/push-device-manager";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getPushIntegrationView, runPushConnectionTest } from "@/lib/services/push/push-integration";
import { sendAgentDeadlineAlertPush } from "@/lib/services/push/send-push";
import { getWebPushDryRunPayload } from "@/lib/services/push/web-push-provider";
import { getFcmDryRunPayload } from "@/lib/services/push/fcm-provider";

export default async function PushIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Push notifications">
        <PageHeader title="Push integration unavailable" description="Your company administrator manages push provider configuration and notification testing." />
      </AppShell>
    );
  }

  const integration = await getPushIntegrationView(context.workspace.id, context.user.id);

  async function testConnection() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await runPushConnectionTest();
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings/integrations/push");
  }

  async function sendTestPush() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await sendAgentDeadlineAlertPush({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      safeDueTiming: "soon",
      dryRun: true
    });
    revalidatePath("/app/settings/notifications");
    revalidatePath("/app/settings/integrations/push");
  }

  const webPushPreview = getWebPushDryRunPayload({
    title: integration.dryRunPreview.webPush.title,
    body: integration.dryRunPreview.webPush.body,
    route: integration.dryRunPreview.webPush.route,
    tag: "document_uploaded"
  });
  const fcmPreview = getFcmDryRunPayload({
    title: integration.dryRunPreview.fcm.title,
    body: integration.dryRunPreview.fcm.body,
    route: integration.dryRunPreview.fcm.route,
    tag: "appointment_reminder"
  });

  return (
    <AppShell title="Push notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="PUSH"
          title="Web Push and FCM alerts"
          description="Push notifications use generic wording and do not include sensitive visa, identity, health, character, financial, or document details."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{integration.provider.providerName}</p>
              </div>
              <StatusPill tone={integration.provider.state === "disabled" ? "neutral" : integration.provider.configured ? "success" : "warning"}>
                {integration.provider.state === "disabled" ? "Disabled" : integration.provider.configured ? "Configured" : "Not configured"}
              </StatusPill>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p>Selected provider: <span className="text-white">{integration.env.provider}</span></p>
              <p>Registered devices: <span className="text-white">{integration.devices.length}</span></p>
              <p>Last sent: <span className="text-white">{integration.notifications[0]?.createdAt ? integration.notifications[0].createdAt.toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{integration.provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
              <p>Unread notifications: <span className="text-white">{integration.unreadCount}</span></p>
            </div>

            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {integration.provider.requiredSetupSteps.map((step: string) => <li key={step}>{step}</li>)}
              {integration.provider.notes.map((note: string) => <li key={note}>{note}</li>)}
            </ul>

            <div className="flex flex-wrap gap-3">
              <form action={testConnection}>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Test connection
                </button>
              </form>
              <form action={sendTestPush}>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Test push
                </button>
              </form>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Browser device registration</h2>
            <p className="text-sm text-slate-400">Web Push is browser-based only in this phase. No native mobile app availability is claimed.</p>
            <PushDeviceManager
              provider={integration.env.provider}
              providerConfigured={integration.provider.configured}
              vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null}
              initialDeviceCount={integration.devices.length}
            />
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Web Push setup state</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>VAPID public key: <span className="text-white">{integration.env.webPush.publicKeyPresent ? "Present" : "Missing"}</span></p>
              <p>VAPID private key: <span className="text-white">{integration.env.webPush.privateKeyPresent ? "Present" : "Missing"}</span></p>
              <p>Contact email: <span className="text-white">{integration.env.webPush.contactEmailPresent ? "Present" : "Missing"}</span></p>
            </div>
            <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{JSON.stringify(webPushPreview, null, 2)}</pre>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">FCM setup state</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Project ID: <span className="text-white">{integration.env.fcm.projectIdPresent ? "Present" : "Missing"}</span></p>
              <p>Client email: <span className="text-white">{integration.env.fcm.clientEmailPresent ? "Present" : "Missing"}</span></p>
              <p>Private key: <span className="text-white">{integration.env.fcm.privateKeyPresent ? "Present" : "Missing"}</span></p>
            </div>
            <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{JSON.stringify(fcmPreview, null, 2)}</pre>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Registered devices</h2>
            <div className="space-y-3">
              {integration.devices.length ? integration.devices.map((device: any) => (
                <div key={device.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{device.platform || "Browser device"}</p>
                  <p className="mt-1 text-xs text-slate-400">Endpoint {device.endpointLast8 ? `***${device.endpointLast8}` : "not shown"}</p>
                  <p className="mt-1 text-xs text-slate-400">Consent {device.consentStatus.replaceAll("_", " ").toLowerCase()}</p>
                </div>
              )) : <p className="text-sm text-slate-400">Push notifications not enabled.</p>}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Redacted push audit / event view</h2>
            <div className="space-y-3">
              {integration.recentAudit.length ? integration.recentAudit.map((event: any) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No push audit events recorded yet.</p>}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
