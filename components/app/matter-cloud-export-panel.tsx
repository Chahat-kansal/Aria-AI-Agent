import { revalidatePath } from "next/cache";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { runCloudDriveExport, getMatterCloudExportPanelView } from "@/lib/services/cloud-drive/cloud-drive-export";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { hasPermission } from "@/lib/services/roles";

export async function MatterCloudExportPanel({ matterId }: { matterId: string }) {
  const context = await requireCurrentWorkspaceContext();
  const panel = await getMatterCloudExportPanelView({ workspaceId: context.workspace.id, matterId });
  if (!panel) return null;

  async function exportAction(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const exportType = String(formData.get("exportType") || "matter_folder") as any;
    const dryRun = String(formData.get("dryRun") || "true") !== "false";
    const selectedDocumentIds = formData.getAll("documentIds").map(String).filter(Boolean);
    const invoiceId = String(formData.get("invoiceId") || "").trim() || null;
    const acknowledgementRequestId = String(formData.get("acknowledgementRequestId") || "").trim() || null;
    await runCloudDriveExport({
      workspaceId: context.workspace.id,
      matterId,
      user: context.user,
      exportType,
      selectedDocumentIds: selectedDocumentIds.length ? selectedDocumentIds : null,
      invoiceId,
      acknowledgementRequestId,
      dryRun
    });
    revalidatePath(`/app/matters/${matterId}`);
    revalidatePath("/app/settings/integrations/cloud-drive");
    revalidatePath("/app/settings/integrations");
  }

  const exportEnabled = hasPermission(context.user, "can_export_data");
  const latestJob = panel.jobs[0];

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Matter cloud export</h3>
            <p className="mt-1 text-sm text-slate-400">Cloud exports are permission-checked and do not expose raw storage URLs. Sensitive documents should only be exported by authorised users.</p>
          </div>
          <StatusPill tone={panel.provider.configured ? "info" : "warning"}>
            {panel.provider.configured ? "Provider configured" : "Provider not configured"}
          </StatusPill>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <form action={exportAction} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input type="hidden" name="exportType" value="matter_folder" />
            <input type="hidden" name="dryRun" value="true" />
            <p className="text-sm font-medium text-white">Export matter folder</p>
            <p className="mt-2 text-xs text-slate-400">Exports authorised matter docs, draft pack, invoice records, confirmations, and a redacted manifest.</p>
            <button disabled={!exportEnabled} className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white disabled:opacity-50">
              Dry-run export manifest
            </button>
          </form>
          <form action={exportAction} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input type="hidden" name="exportType" value="draft_pack" />
            <input type="hidden" name="dryRun" value="true" />
            <p className="text-sm font-medium text-white">Export draft pack</p>
            <p className="mt-2 text-xs text-slate-400">Exports generated draft pack and review artefacts only.</p>
            <button disabled={!exportEnabled} className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white disabled:opacity-50">
              Draft pack preview
            </button>
          </form>
          <form action={exportAction} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input type="hidden" name="exportType" value="selected_documents" />
            <input type="hidden" name="dryRun" value="true" />
            {panel.matter.documents.slice(0, 4).map((document: (typeof panel.matter.documents)[number]) => (
              <input key={document.id} type="hidden" name="documentIds" value={document.id} />
            ))}
            <p className="text-sm font-medium text-white">Export selected documents</p>
            <p className="mt-2 text-xs text-slate-400">Uses the selected authorised document subset only.</p>
            <button disabled={!exportEnabled} className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white disabled:opacity-50">
              Selected document preview
            </button>
          </form>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-medium text-white">Local secure ZIP fallback</p>
            <p className="mt-2 text-xs text-slate-400">If cloud drive is not configured, use the existing secure ZIP export route.</p>
            <a href={panel.localZipFallbackHref} className="mt-3 inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white">
              Open ZIP fallback
            </a>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Export status and retry</h3>
            <p className="mt-1 text-sm text-slate-400">Recent export jobs for this matter, including skipped-file reasons and retry state.</p>
          </div>
          <StatusPill tone={latestJob?.exportStatus === "FAILED" ? "danger" : latestJob ? "info" : "neutral"}>
            {latestJob ? latestJob.exportStatus.replaceAll("_", " ").toLowerCase() : "No jobs yet"}
          </StatusPill>
        </div>
        <div className="space-y-3">
          {panel.jobs.length ? panel.jobs.map((job: (typeof panel.jobs)[number]) => (
            <div key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-white">{job.exportType.replaceAll("_", " ")}</p>
                <StatusPill tone={job.exportStatus === "COMPLETED" ? "success" : job.exportStatus === "FAILED" ? "danger" : "warning"}>
                  {job.exportStatus.replaceAll("_", " ").toLowerCase()}
                </StatusPill>
              </div>
              <p className="mt-1 text-xs text-slate-400">{job.createdAt.toLocaleString("en-AU")}</p>
              <p className="mt-2 text-xs text-slate-400">Items: {job.items.length} {job.lastError ? `| Last error: ${job.lastError}` : ""}</p>
            </div>
          )) : <p className="text-sm text-slate-400">No cloud drive export history is recorded for this matter yet.</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-200">
          <pre className="overflow-x-auto">{JSON.stringify(panel.latestPreview || { status: "No dry-run manifest recorded yet." }, null, 2)}</pre>
        </div>
      </Card>
    </div>
  );
}
