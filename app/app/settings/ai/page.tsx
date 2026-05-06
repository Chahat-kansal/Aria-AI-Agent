import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { prisma } from "@/lib/prisma";
import { getAiConfigStatus } from "@/lib/services/runtime-config";

export default async function AiSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="AI settings">
        <PageHeader title="AI settings unavailable" description="Your company administrator controls workspace AI settings." />
      </AppShell>
    );
  }
  const settings = await getWorkspaceOperationalSettingsView(context.workspace.id);
  const aiStatus = getAiConfigStatus();

  async function saveSettings(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await prisma.workspaceOperationalSettings.update({
      where: { workspaceId: context.workspace.id },
      data: {
        aiDraftAutofillEnabled: String(formData.get("aiDraftAutofillEnabled") || "") === "on",
        aiReviewRequiredDefault: String(formData.get("aiReviewRequiredDefault") || "") === "on",
        aiNoticeText: String(formData.get("aiNoticeText") || settings.aiNoticeText)
      }
    });
    revalidatePath("/app/settings/ai");
  }

  return (
    <AppShell title="AI settings">
      <div className="space-y-8">
        <PageHeader
          eyebrow="AI SETTINGS"
          title="AI review-required defaults"
          description="Aria is AI-assisted practice software for registered migration agents. It does not provide final legal advice, does not guarantee visa outcomes, and does not lodge applications."
        />
        <PageSection title="Workspace AI controls">
          <form action={saveSettings}>
            <SectionCard className="space-y-4 p-5">
              <p className="text-sm text-slate-300">{aiStatus.configured ? `AI provider configured: ${aiStatus.provider}.` : "AI is not configured. Add OPENAI_API_KEY to enable assistant and draft autofill features."}</p>
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" name="aiDraftAutofillEnabled" defaultChecked={settings.aiDraftAutofillEnabled} />
                Enable AI draft autofill where source-backed evidence exists
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" name="aiReviewRequiredDefault" defaultChecked={settings.aiReviewRequiredDefault} />
                Require review-required messaging by default
              </label>
              <label className="text-sm text-slate-300">AI notice
                <textarea name="aiNoticeText" defaultValue={settings.aiNoticeText} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                Save AI settings
              </button>
            </SectionCard>
          </form>
        </PageSection>
        <PageSection title="Operational guidance">
          <SectionCard className="p-5">
            <p className="text-sm text-slate-300">If AI is not configured, Aria shows honest “not configured” states instead of fake answers or silent failures. Review the <Link href="/app/settings/security" className="text-cyan-300 hover:text-cyan-200">Security Vault</Link> for runtime health.</p>
          </SectionCard>
        </PageSection>
      </div>
    </AppShell>
  );
}

