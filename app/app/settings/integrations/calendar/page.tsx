import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import {
  getCalendarIntegrationView,
  runCalendarConnectionTest,
  saveSelectedCalendar
} from "@/lib/services/calendar/calendar-integration";
import { disconnectCalendarProvider } from "@/lib/services/calendar/calendar-oauth";
import { getCalendarProviderName } from "@/lib/providers/calendar-provider";

export default async function CalendarIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Calendar integration">
        <PageHeader title="Calendar integration unavailable" description="Your company administrator manages calendar provider setup." />
      </AppShell>
    );
  }

  const integration = await getCalendarIntegrationView(context.workspace.id, context.user.id);

  async function testConnection() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await runCalendarConnectionTest({ workspaceId: context.workspace.id, userId: context.user.id });
    revalidatePath("/app/settings/integrations/calendar");
    revalidatePath("/app/settings/integrations");
  }

  async function disconnectProvider() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await disconnectCalendarProvider({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      provider: getCalendarProviderName()
    });
    revalidatePath("/app/settings/integrations/calendar");
    revalidatePath("/app/settings/integrations");
  }

  async function selectCalendar(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    const calendarId = String(formData.get("calendarId") || "").trim() || null;
    await saveSelectedCalendar({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      calendarId
    });
    revalidatePath("/app/settings/integrations/calendar");
  }

  return (
    <AppShell title="Calendar integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="CALENDAR"
          title="Google / Microsoft calendar integration"
          description="Calendar events use privacy-safe titles and do not include sensitive visa or document details."
          action={<Link href={"/app/settings/appointments" as any} className="text-sm text-cyan-300 hover:text-white">Open appointment settings</Link>}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{integration.provider.providerName}</p>
              </div>
              <StatusPill tone={integration.provider.state === "disabled" ? "neutral" : integration.provider.configured && integration.connection?.connected ? "success" : "warning"}>
                {integration.provider.state === "disabled" ? "Disabled" : integration.provider.configured && integration.connection?.connected ? "Connected" : integration.provider.configured ? "Needs connection" : "Not configured"}
              </StatusPill>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p>Connection state: <span className="text-white">{integration.connection?.connectionState?.replaceAll("_", " ") || integration.provider.connectionState.replaceAll("_", " ")}</span></p>
              <p>Connected account: <span className="text-white">{integration.connection?.connectedAccountLabel || "Not connected"}</span></p>
              <p>Selected calendar: <span className="text-white">{integration.selectedCalendarId || "Not selected"}</span></p>
              <p>Last sync: <span className="text-white">{integration.connection?.lastSyncAt ? new Date(integration.connection.lastSyncAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{integration.connection?.lastErrorSummary || integration.provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
            </div>

            {integration.provider.missingEnv.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Missing environment values: <span className="text-white">{integration.provider.missingEnv.join(", ")}</span>
              </div>
            ) : null}

            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {integration.provider.requiredSetupSteps.map((step) => <li key={step}>{step}</li>)}
              {integration.provider.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>

            <div className="flex flex-wrap gap-3">
              {integration.authorizationUrl ? (
                <a href={integration.authorizationUrl} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                  Connect provider
                </a>
              ) : (
                <button disabled className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-slate-500">
                  Calendar provider not configured
                </button>
              )}
              <form action={testConnection}>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Test connection
                </button>
              </form>
              {integration.connection?.connected ? (
                <form action={disconnectProvider}>
                  <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                    Disconnect
                  </button>
                </form>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Dry-run safe event preview</h2>
            <p className="text-sm text-slate-400">This preview is privacy-safe only. It does not claim a live Google or Microsoft event was created.</p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">{JSON.stringify(integration.dryRunPreview, null, 2)}</pre>
            <p className="text-xs text-slate-400">Safety note: Calendar events use privacy-safe titles and do not include sensitive visa or document details.</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Calendar selection</h2>
              <p className="mt-1 text-sm text-slate-400">Choose which connected calendar Aria should use for appointment sync. If no provider is connected, appointment requests remain inside Aria only.</p>
            </div>
            <form action={selectCalendar} className="space-y-3">
              <select name="calendarId" defaultValue={integration.selectedCalendarId || ""} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white">
                <option value="">Use provider default calendar</option>
                {integration.calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}{calendar.primary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                Save calendar selection
              </button>
            </form>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Recent calendar audit</h2>
            <div className="space-y-3">
              {integration.recentAudit.length ? integration.recentAudit.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No calendar integration events have been recorded yet.</p>}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
