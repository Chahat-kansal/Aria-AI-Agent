import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { prisma } from "@/lib/prisma";
import { getEmailConfigStatus } from "@/lib/services/runtime-config";

export default async function ClientPortalSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Client portal settings">
        <PageHeader title="Client portal settings unavailable" description="Your company administrator controls client portal configuration." />
      </AppShell>
    );
  }

  const settings = await getWorkspaceOperationalSettingsView(context.workspace.id);
  const emailStatus = getEmailConfigStatus();

  async function saveSettings(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await prisma.workspaceOperationalSettings.update({
      where: { workspaceId: context.workspace.id },
      data: {
        clientPortalExpiryDays: Number(formData.get("clientPortalExpiryDays") || settings.clientPortalExpiryDays),
        clientPortalConsentNotice: String(formData.get("clientPortalConsentNotice") || settings.clientPortalConsentNotice),
        clientPortalHelpText: String(formData.get("clientPortalHelpText") || settings.clientPortalHelpText),
        clientPortalEmailTemplate: String(formData.get("clientPortalEmailTemplate") || settings.clientPortalEmailTemplate || "")
      }
    });
    revalidatePath("/app/settings/client-portal");
  }

  return (
    <AppShell title="Client portal settings">
      <div className="space-y-8">
        <PageHeader
          eyebrow="CLIENT PORTAL SETTINGS"
          title="Secure portal defaults"
          description="Portal links stay token-scoped and private. Raw tokens are shown only once at generation time."
        />

        <PageSection title="Portal behavior" description="These defaults are used when staff generate portal links from a matter workspace.">
          <form action={saveSettings}>
            <SectionCard className="grid gap-4 p-5">
              <label className="text-sm text-slate-300">Default link expiry (days)
                <input name="clientPortalExpiryDays" type="number" min={1} defaultValue={settings.clientPortalExpiryDays} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Consent wording
                <textarea name="clientPortalConsentNotice" defaultValue={settings.clientPortalConsentNotice} className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <label className="text-sm text-slate-300">Help note
                <textarea name="clientPortalHelpText" defaultValue={settings.clientPortalHelpText} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <label className="text-sm text-slate-300">Email template intro
                <textarea name="clientPortalEmailTemplate" defaultValue={settings.clientPortalEmailTemplate ?? ""} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                Save client portal settings
              </button>
            </SectionCard>
          </form>
        </PageSection>

        <PageSection title="Delivery state">
          <SectionCard className="p-5">
            <p className="text-sm text-slate-300">
              {emailStatus.configured
                ? "Email is configured. Owners and permitted staff can email fresh secure portal links directly from the matter workspace."
                : "Email is not configured. Copy the secure link and send it manually."}
            </p>
          </SectionCard>
        </PageSection>
      </div>
    </AppShell>
  );
}

