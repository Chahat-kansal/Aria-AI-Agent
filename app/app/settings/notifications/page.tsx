import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PushDeviceManager } from "@/components/app/push-device-manager";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getPushIntegrationView, saveNotificationPreference } from "@/lib/services/push/push-integration";
import { markAllInAppNotificationsRead, markInAppNotificationRead } from "@/lib/services/push/device-subscriptions";
import { sendAppointmentReminderPush } from "@/lib/services/push/send-push";

export default async function NotificationsSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  const integration = await getPushIntegrationView(context.workspace.id, context.user.id);

  async function togglePush(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const enabled = String(formData.get("enabled") || "") === "true";
    await saveNotificationPreference({ workspaceId: context.workspace.id, userId: context.user.id, pushEnabled: enabled });
    revalidatePath("/app/settings/notifications");
  }

  async function toggleInApp(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const enabled = String(formData.get("enabled") || "") === "true";
    await saveNotificationPreference({ workspaceId: context.workspace.id, userId: context.user.id, inAppEnabled: enabled });
    revalidatePath("/app/settings/notifications");
  }

  async function markRead(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const notificationId = String(formData.get("notificationId") || "");
    await markInAppNotificationRead({ workspaceId: context.workspace.id, userId: context.user.id, notificationId });
    revalidatePath("/app/settings/notifications");
  }

  async function markAllRead() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    await markAllInAppNotificationsRead({ workspaceId: context.workspace.id, userId: context.user.id });
    revalidatePath("/app/settings/notifications");
  }

  async function sendSafeTestNotification() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    await sendAppointmentReminderPush({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      dryRun: true,
      isAgentAlert: true,
      allowWithoutConsent: true
    });
    revalidatePath("/app/settings/notifications");
  }

  return (
    <AppShell title="Notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="NOTIFICATIONS"
          title="Push and in-app notifications"
          description="Push notifications use generic wording and do not include sensitive visa, identity, health, character, financial, or document details."
          action={<Link href={"/app/settings/integrations/push" as any} className="text-sm text-cyan-300 hover:text-white">Open push integration</Link>}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Notification preferences</h2>
                <p className="mt-1 text-sm text-slate-400">Use in-app notifications as the safe fallback when push is disabled or not configured.</p>
              </div>
              <StatusPill tone={integration.preference?.pushEnabled ? "success" : "neutral"}>
                {integration.preference?.pushEnabled ? "Push enabled" : "Push notifications not enabled"}
              </StatusPill>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <form action={togglePush}>
                <input type="hidden" name="enabled" value={integration.preference?.pushEnabled ? "false" : "true"} />
                <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  {integration.preference?.pushEnabled ? "Disable push" : "Enable push"}
                </button>
              </form>
              <form action={toggleInApp}>
                <input type="hidden" name="enabled" value={integration.preference?.inAppEnabled === false ? "true" : "false"} />
                <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  {integration.preference?.inAppEnabled === false ? "Enable in-app fallback" : "Disable in-app fallback"}
                </button>
              </form>
              <form action={sendSafeTestNotification}>
                <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                  Test push
                </button>
              </form>
              <form action={markAllRead}>
                <button className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Mark all as read
                </button>
              </form>
            </div>

            <PushDeviceManager
              provider={integration.env.provider}
              providerConfigured={integration.provider.configured}
              vapidPublicKey={process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null}
              initialDeviceCount={integration.devices.length}
            />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Device registration status</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Selected provider: <span className="text-white">{integration.env.provider}</span></p>
              <p>Registered devices: <span className="text-white">{integration.devices.length}</span></p>
              <p>Unread notifications: <span className="text-white">{integration.unreadCount}</span></p>
              <p>Quiet hours: <span className="text-white">{integration.preference?.quietHoursEnabled ? "Enabled" : "Placeholder / not enabled"}</span></p>
            </div>
            <p className="text-xs leading-6 text-slate-400">Push notifications not enabled should always fall back to in-app notifications. No sensitive facts are sent in push payloads.</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">In-app notification centre</h2>
                <p className="mt-1 text-sm text-slate-400">Notifications stay generic and link back into safe app routes only.</p>
              </div>
              <StatusPill tone={integration.unreadCount > 0 ? "warning" : "success"}>
                {integration.unreadCount} unread
              </StatusPill>
            </div>
            <div className="space-y-3">
              {integration.notifications.length ? integration.notifications.map((notification: any) => (
                <div key={notification.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{notification.title}</p>
                      <p className="mt-1 text-slate-300">{notification.bodyPreviewRedacted}</p>
                      <p className="mt-2 text-xs text-slate-400">{notification.createdAt.toLocaleString("en-AU")}</p>
                    </div>
                    <StatusPill tone={notification.isRead ? "neutral" : "warning"}>
                      {notification.isRead ? "Read" : "Unread"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {notification.route ? (
                      <Link href={notification.route as any} className="text-sm font-medium text-cyan-300 hover:text-white">
                        Open
                      </Link>
                    ) : null}
                    {!notification.isRead ? (
                      <form action={markRead}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <button className="text-sm font-medium text-slate-300 hover:text-white">Mark as read</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">No notifications yet.</p>}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Notification preferences</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">Push delivery</p>
                <p className="mt-2">{integration.preference?.pushEnabled ? "Enabled for this user" : "Push notifications not enabled"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">In-app fallback</p>
                <p className="mt-2">{integration.preference?.inAppEnabled === false ? "Disabled by user" : "Enabled"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">Consent</p>
                <p className="mt-2">{integration.preference?.pushEnabled ? "Opt-in recorded" : "Push notifications not enabled"}</p>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
