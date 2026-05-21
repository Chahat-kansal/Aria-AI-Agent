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
import { buildFirmTemplateLibraryView } from "@/lib/services/firm-template-library";
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

  const [templates, draftPdfSettings, generatedTemplateCount, invoiceTemplateCount] = await Promise.all([
    prisma.officialFormTemplate.findMany({
      where: { OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] },
      orderBy: [{ supportStatus: "asc" }, { formNumber: "asc" }]
    }),
    getWorkspaceDraftPdfSettings(context.workspace.id),
    prisma.generatedDocument.count({ where: { workspaceId: context.workspace.id } }),
    prisma.invoiceTemplate.count({ where: { workspaceId: context.workspace.id } })
  ]);
  const firmTemplateLibrary = buildFirmTemplateLibraryView({
    firmProvidedPdfCount: templates.filter((template) => template.workspaceId === context.workspace.id).length,
    generatedTemplateCount,
    invoiceTemplateCount
  });

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
        <PageSection title="Firm precedent and template library" description="Reuse firm-approved structures safely. Client-derived content is never shared into a platform library by default.">
          <div className="grid gap-4 lg:grid-cols-2">
            {firmTemplateLibrary.items.map((item) => (
              <SectionCard key={item.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.category.replaceAll("_", " ")} - {item.source.replaceAll("_", " ")}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">Review required</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">{item.safePopulationRule}</p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-slate-400">
                  <p><span className="text-slate-200">Versioning:</span> {item.versioningRule}</p>
                  <p className="mt-1"><span className="text-slate-200">Approval:</span> {item.approvalRule}</p>
                </div>
              </SectionCard>
            ))}
          </div>
          <SectionCard className="mt-4 border border-amber-300/20 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Privacy rule</p>
            <p className="mt-2 text-sm leading-6 text-amber-100/85">
              Firm templates can populate only from approved Working Data Pack fields, verified draft fields, submitted client confirmations, matter metadata, and workspace profile data. Platform-wide sharing from real client content is disabled by design.
            </p>
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
