import { notFound } from "next/navigation";
import { WorkspacePlan } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, auditPlatformAdminAction } from "@/lib/services/platform-admin";
import { getWorkspaceDetail, safeJson } from "@/lib/services/platform-admin-data";
import { getWorkspaceLaunchControls, updateWorkspaceLaunchControls } from "@/lib/services/launch-controls";

async function updateWorkspaceMetadata(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") || "");
  const plan = String(formData.get("plan") || "STARTER") as WorkspacePlan;
  await prisma.workspace.update({ where: { id: workspaceId }, data: { plan } });
  await auditPlatformAdminAction(admin.user, "platform.workspace.plan_updated", { workspaceId, plan });
}

async function updateLaunchControls(formData: FormData) {
  "use server";
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") || "");
  const current = await getWorkspaceLaunchControls(workspaceId);
  const controls = {
    ...current,
    betaModeEnabled: formData.get("betaModeEnabled") === "on",
    allowRealClientUploads: formData.get("allowRealClientUploads") === "on",
    clientPortalEnabled: formData.get("clientPortalEnabled") === "on",
    aiDraftAutofillEnabled: formData.get("aiDraftAutofillEnabled") === "on",
    pdfFormFillingEnabled: formData.get("pdfFormFillingEnabled") === "on",
    exportEnabled: formData.get("exportEnabled") === "on",
    publicSignupEnabled: formData.get("publicSignupEnabled") === "on",
    allowedSubclasses: String(formData.get("allowedSubclasses") || "").split(",").map((item) => item.trim()).filter(Boolean)
  };
  await updateWorkspaceLaunchControls(workspaceId, controls);
  await auditPlatformAdminAction(admin.user, "platform.workspace.launch_controls_updated", { workspaceId, controls });
}

export default async function WorkspaceDetailPage({ params }: { params: { workspaceId: string } }) {
  const workspace = await getWorkspaceDetail(params.workspaceId);
  if (!workspace) notFound();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="WORKSPACE" title={workspace.name} description="Workspace operational metadata. Private client and matter content remains redacted and unavailable here." />
      <section className="grid gap-4 lg:grid-cols-3">
        <SectionCard><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Users</p><p className="mt-3 text-3xl font-semibold">{workspace.counts.users}</p></SectionCard>
        <SectionCard><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Matters</p><p className="mt-3 text-3xl font-semibold">{workspace.counts.matters}</p></SectionCard>
        <SectionCard><p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-tertiary)]">Documents</p><p className="mt-3 text-3xl font-semibold">{workspace.counts.documents}</p></SectionCard>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <h2 className="text-lg font-semibold">Plan / billing metadata</h2>
          <form action={updateWorkspaceMetadata} className="mt-4 grid gap-3">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            <select name="plan" defaultValue={workspace.plan} className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
              {Object.values(WorkspacePlan).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
            </select>
            <button className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">Update plan</button>
          </form>
        </SectionCard>
        <SectionCard>
          <h2 className="text-lg font-semibold">Launch controls</h2>
          <form action={updateLaunchControls} className="mt-4 grid gap-3 text-sm">
            <input type="hidden" name="workspaceId" value={workspace.id} />
            {[
              ["betaModeEnabled", "Beta mode", workspace.controls?.betaModeEnabled],
              ["allowRealClientUploads", "Allow real client uploads", workspace.controls?.allowRealClientUploads],
              ["clientPortalEnabled", "Client portal", workspace.controls?.clientPortalEnabled],
              ["aiDraftAutofillEnabled", "AI draft autofill", workspace.controls?.aiDraftAutofillEnabled],
              ["pdfFormFillingEnabled", "PDF form filling", workspace.controls?.pdfFormFillingEnabled],
              ["exportEnabled", "Secure exports", workspace.controls?.exportEnabled],
              ["publicSignupEnabled", "Public signup", workspace.controls?.publicSignupEnabled]
            ].map(([name, label, checked]) => (
              <label key={String(name)} className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-soft)] p-3">
                <span>{label}</span><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} />
              </label>
            ))}
            <input name="allowedSubclasses" defaultValue={workspace.controls?.allowedSubclasses.join(", ") ?? ""} className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3" />
            <button className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">Save launch controls</button>
          </form>
        </SectionCard>
      </section>
      <SectionCard>
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="mt-4 grid gap-2">
          {workspace.users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--surface-soft)] p-3 text-sm">
              <div><p className="font-medium">{user.name}</p><p className="text-xs text-[color:var(--text-tertiary)]">{user.email}</p></div>
              <StatusPill tone={user.status === "ACTIVE" ? "success" : "warning"}>{user.role} · {user.status}</StatusPill>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard>
        <h2 className="text-lg font-semibold">Redacted audit summary</h2>
        <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-[color:var(--surface-soft)] p-4 text-xs">{safeJson(workspace.auditEvents)}</pre>
      </SectionCard>
    </div>
  );
}

