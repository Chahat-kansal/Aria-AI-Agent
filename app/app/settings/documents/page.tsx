import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { prisma } from "@/lib/prisma";

export default async function DocumentSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Document settings">
        <PageHeader title="Document settings unavailable" description="Your company administrator controls document upload and storage settings." />
      </AppShell>
    );
  }
  const settings = await getWorkspaceOperationalSettingsView(context.workspace.id);

  async function saveSettings(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await prisma.workspaceOperationalSettings.update({
      where: { workspaceId: context.workspace.id },
      data: {
        documentMaxUploadBytes: Number(formData.get("documentMaxUploadBytes") || settings.documentMaxUploadBytes),
        documentAllowedMimeTypesJson: String(formData.get("documentAllowedMimeTypes") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        documentCategoriesJson: String(formData.get("documentCategories") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      }
    });
    revalidatePath("/app/settings/documents");
  }

  return (
    <AppShell title="Document settings">
      <div className="space-y-8">
        <PageHeader
          eyebrow="DOCUMENT SETTINGS"
          title="Secure upload defaults"
          description="Document uploads remain private, permission-checked, and encryption-gated in production. Dangerous file types are always rejected."
        />
        <PageSection title="Upload controls">
          <form action={saveSettings}>
            <SectionCard className="grid gap-4 p-5">
              <label className="text-sm text-slate-300">Maximum upload bytes
                <input name="documentMaxUploadBytes" type="number" min={1024} defaultValue={settings.documentMaxUploadBytes} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Allowed MIME types (comma separated)
                <textarea name="documentAllowedMimeTypes" defaultValue={settings.documentAllowedMimeTypes.join(", ")} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <label className="text-sm text-slate-300">Document categories (comma separated)
                <textarea name="documentCategories" defaultValue={settings.documentCategories.join(", ")} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                Save document settings
              </button>
            </SectionCard>
          </form>
        </PageSection>
      </div>
    </AppShell>
  );
}

