import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getCloudDriveIntegrationView, runCloudDriveConnectionTest, saveSelectedCloudDriveFolder } from "@/lib/services/cloud-drive/cloud-drive-export";
import { disconnectCloudDriveProvider } from "@/lib/services/cloud-drive/cloud-drive-oauth";

export default async function CloudDriveIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Cloud drive integration">
        <PageHeader title="Cloud drive integration unavailable" description="Your company administrator manages cloud drive export configuration." />
      </AppShell>
    );
  }

  const integration = await getCloudDriveIntegrationView(context.workspace.id, context.user.id);

  async function testConnection() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await runCloudDriveConnectionTest({ workspaceId: context.workspace.id, userId: context.user.id });
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings/integrations/cloud-drive");
  }

  async function disconnectProvider() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await disconnectCloudDriveProvider({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      provider: integration.status.provider
    });
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings/integrations/cloud-drive");
  }

  async function saveFolder(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    const folderId = String(formData.get("folderId") || "").trim() || null;
    await saveSelectedCloudDriveFolder({ workspaceId: context.workspace.id, folderId });
    revalidatePath("/app/settings/integrations/cloud-drive");
  }

  return (
    <AppShell title="Cloud drive integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="CLOUD DRIVE"
          title="Google Drive / OneDrive export"
          description="Cloud exports are permission-checked and do not expose raw storage URLs. Sensitive documents should only be exported by authorised users."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
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
              <p>Selected provider: <span className="text-white">{integration.status.provider}</span></p>
              <p>Connected account: <span className="text-white">{integration.connection?.connectedAccountLabel || "Not connected"}</span></p>
              <p>Selected export folder: <span className="text-white">{integration.selectedFolderId || "Not selected"}</span></p>
              <p>Last export: <span className="text-white">{integration.recentJobs[0]?.completedAt ? new Date(integration.recentJobs[0].completedAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
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
                  Cloud drive provider not configured
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
            <h2 className="text-lg font-semibold text-white">Dry-run export manifest preview</h2>
            <p className="text-sm text-slate-400">This preview shows the redacted export manifest only. It does not claim a live Google Drive or OneDrive upload happened.</p>
            <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">{JSON.stringify(integration.dryRunManifestPreview, null, 2)}</pre>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Selected export folder</h2>
              <p className="mt-1 text-sm text-slate-400">Choose the connected folder Aria should use as the root for secure matter exports.</p>
            </div>
            <form action={saveFolder} className="space-y-3">
              <select name="folderId" defaultValue={integration.selectedFolderId || ""} className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white">
                <option value="">Use provider root folder</option>
                {integration.folders.map((folder: (typeof integration.folders)[number]) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                Save folder selection
              </button>
            </form>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Google Drive / OneDrive setup state</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">Google Drive</p>
                <p className="mt-2">Configured: <span className="text-white">{integration.provider.missingEnv.includes("GOOGLE_DRIVE_CLIENT_ID") ? "No" : "Check env state above"}</span></p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">OneDrive</p>
                <p className="mt-2">Configured: <span className="text-white">{integration.provider.missingEnv.includes("MICROSOFT_DRIVE_CLIENT_ID") ? "No" : "Check env state above"}</span></p>
              </div>
            </div>
            <p className="text-xs text-slate-400">{integration.localZipFallback.note}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Recent export history</h2>
            <div className="space-y-3">
              {integration.recentJobs.length ? integration.recentJobs.map((job: (typeof integration.recentJobs)[number]) => (
                <div key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{job.exportType.replaceAll("_", " ")}</p>
                    <StatusPill tone={job.exportStatus === "COMPLETED" ? "success" : job.exportStatus === "FAILED" ? "danger" : "warning"}>
                      {job.exportStatus.replaceAll("_", " ").toLowerCase()}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{job.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No cloud drive export job has been recorded yet.</p>}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Redacted audit view</h2>
            <div className="space-y-3">
              {integration.recentAudit.length ? integration.recentAudit.map((event: (typeof integration.recentAudit)[number]) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No cloud drive audit events have been recorded yet.</p>}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
