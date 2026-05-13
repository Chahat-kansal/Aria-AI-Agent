import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getWorkspaceRows } from "@/lib/services/platform-admin-data";

export default async function AdminLaunchControlsPage() {
  const workspaces = await getWorkspaceRows();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="LAUNCH" title="Launch controls" description="Platform view of workspace launch gates and overrides. Edit controls from a workspace detail page." />
      <SectionCard>
        <div className="grid gap-3">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">{workspace.name}</p><p className="text-xs text-[color:var(--text-tertiary)]">{workspace.slug}</p></div>
                <Link href={`/admin/workspaces/${workspace.id}` as any} className="text-sm text-violet-400">Edit controls</Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill tone={workspace.launch?.betaModeEnabled ? "warning" : "success"}>{workspace.launch?.betaModeEnabled ? "beta mode" : "beta off"}</StatusPill>
                <StatusPill tone={workspace.launch?.allowRealClientUploads ? "warning" : "neutral"}>{workspace.launch?.allowRealClientUploads ? "real uploads allowed" : "real uploads off"}</StatusPill>
                <StatusPill tone={workspace.launch?.publicSignupEnabled ? "danger" : "success"}>{workspace.launch?.publicSignupEnabled ? "public signup on" : "public signup off"}</StatusPill>
                <StatusPill tone={workspace.launch?.clientPortalEnabled ? "success" : "warning"}>client portal {workspace.launch?.clientPortalEnabled ? "on" : "off"}</StatusPill>
                <StatusPill tone={workspace.launch?.aiDraftAutofillEnabled ? "success" : "warning"}>AI autofill {workspace.launch?.aiDraftAutofillEnabled ? "on" : "off"}</StatusPill>
                <StatusPill tone={workspace.launch?.pdfFormFillingEnabled ? "success" : "warning"}>PDF filling {workspace.launch?.pdfFormFillingEnabled ? "on" : "off"}</StatusPill>
              </div>
              <p className="mt-3 text-xs text-[color:var(--text-tertiary)]">Allowed subclasses: {workspace.launch?.allowedSubclasses.join(", ") || "Not configured"}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
