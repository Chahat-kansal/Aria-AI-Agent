import { AppShell } from "@/components/app/app-shell";
import { DraftPdfSettingsForm } from "@/components/app/draft-pdf-settings-form";
import { FirmTemplateUploadForm } from "@/components/app/firm-template-upload-form";
import { FormsSyncAction } from "@/components/app/forms-sync-action";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceDraftPdfSettings } from "@/lib/services/draft-pdf-settings";
import { prisma } from "@/lib/prisma";

export default async function FormSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Form settings">
        <PageHeader title="Form settings unavailable" description="Your company administrator controls official forms sync and firm template management." />
      </AppShell>
    );
  }

  const [templates, draftPdfSettings] = await Promise.all([
    prisma.officialFormTemplate.findMany({
      where: { OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] },
      orderBy: [{ supportStatus: "asc" }, { formNumber: "asc" }]
    }),
    getWorkspaceDraftPdfSettings(context.workspace.id)
  ]);

  return (
    <AppShell title="Form settings">
      <div className="space-y-8">
        <PageHeader
          eyebrow="FORM SETTINGS"
          title="Official form sync and template review"
          description="Sync official Home Affairs PDFs where supported, inspect fillable status, and keep non-fillable or online-only forms honest."
          action={<FormsSyncAction canSync />}
        />
        <PageSection title="Current library">
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <SectionCard key={template.id} className="space-y-2 p-4">
                <p className="text-sm font-semibold text-white">Form {template.formNumber} · {template.title}</p>
                <p className="text-xs text-slate-500">{template.supportStatus.toLowerCase().replaceAll("_", " ")} · {template.lifecycleStatus.toLowerCase().replaceAll("_", " ")}</p>
              </SectionCard>
            ))}
          </div>
        </PageSection>
        <PageSection title="Firm-provided templates" description="Upload a firm-provided PDF template only when it is genuinely part of your workflow. It stays clearly marked as firm-provided.">
          <SectionCard className="p-5">
            <FirmTemplateUploadForm />
          </SectionCard>
        </PageSection>
        <PageSection title="Firm-branded draft PDFs" description="These settings appear on generated PDF draft versions. They do not make a draft final, lodged, or legally reviewed.">
          <SectionCard className="p-5">
            <DraftPdfSettingsForm settings={draftPdfSettings} />
          </SectionCard>
        </PageSection>
      </div>
    </AppShell>
  );
}
