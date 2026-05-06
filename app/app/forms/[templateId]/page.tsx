import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { FormsSyncAction } from "@/components/app/forms-sync-action";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { inspectPdfFormFields, mapPdfFieldsToAriaFields } from "@/lib/services/pdf-form-engine";
import { canManageTeam, hasPermission } from "@/lib/services/roles";

export default async function OfficialFormTemplatePage({ params }: { params: { templateId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Official Form">
        <PageHeader title="Official form" description="Create or join a workspace to inspect official form templates." />
      </AppShell>
    );
  }
  if (!hasPermission(context.user, "can_edit_matters")) notFound();

  const template = await prisma.officialFormTemplate.findFirst({
    where: { id: params.templateId, OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] }
  });
  if (!template) notFound();

  const [inspection, mapping, drafts] = await Promise.all([
    inspectPdfFormFields(template.id),
    mapPdfFieldsToAriaFields(template.id),
    prisma.matterOfficialFormDraft.findMany({
      where: { workspaceId: context.workspace.id, templateId: template.id },
      include: { matter: { include: { client: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10
    })
  ]);

  const canSync = canManageTeam(context.user);

  return (
    <AppShell title="Official Form">
      <div className="space-y-8">
        <PageHeader
          eyebrow="OFFICIAL FORM TEMPLATE"
          title={`Form ${template.formNumber} · ${template.title}`}
          description={template.sourceUrl ?? "No official source URL is stored for this template."}
          action={<FormsSyncAction canSync={canSync} />}
        />

        <section className="grid gap-4 md:grid-cols-4">
          <SectionCard className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Support</p>
            <p className="mt-2 text-sm text-white">{template.supportStatus.toLowerCase().replaceAll("_", " ")}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Lifecycle</p>
            <p className="mt-2 text-sm text-white">{template.lifecycleStatus.toLowerCase().replaceAll("_", " ")}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Detected fields</p>
            <p className="mt-2 text-sm text-white">{inspection.fields.length}</p>
          </SectionCard>
          <SectionCard className="p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Matter drafts</p>
            <p className="mt-2 text-sm text-white">{drafts.length}</p>
          </SectionCard>
        </section>

        <PageSection title="Template status" description="Supported forms remain review-required. Online-only and manual-only forms are shown honestly.">
          <SectionCard className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={template.lifecycleStatus === "CURRENT" ? "success" : template.lifecycleStatus === "NEEDS_REVIEW" ? "warning" : "danger"}>
                {template.lifecycleStatus.toLowerCase().replaceAll("_", " ")}
              </StatusPill>
              <StatusPill tone={template.supportStatus === "FILLABLE_PDF" ? "info" : "warning"}>
                {template.supportStatus.toLowerCase().replaceAll("_", " ")}
              </StatusPill>
            </div>
            <p className="text-sm text-slate-300">
              {template.supportStatus === "ONLINE_ONLY"
                ? "Online application / no official fillable PDF draft supported."
                : template.supportStatus === "MANUAL_ONLY"
                  ? "This PDF is not fillable. Manual review or coordinate mapping is required."
                  : template.supportStatus === "MAPPING_REQUIRED"
                    ? "Field mapping review is required before reliable draft generation."
                    : "Fillable PDF fields were detected. Registered migration agent review remains required before use."}
            </p>
            {inspection.message ? <p className="text-xs text-amber-300">{inspection.message}</p> : null}
          </SectionCard>
        </PageSection>

        <PageSection title="Detected PDF fields" description="These are real AcroForm fields where present. No fake successful filling is shown for unsupported templates.">
          <div className="grid gap-3">
            {inspection.fields.length ? inspection.fields.map((field) => {
              const suggestion = mapping.suggestions.find((item) => item.fieldName === field.name);
              return (
                <SectionCard key={field.name} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{field.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{field.type}</p>
                    </div>
                    <StatusPill tone={suggestion?.mappedFieldKey ? "info" : "warning"}>
                      {suggestion?.mappedFieldKey ? suggestion.mappedFieldKey : "Mapping required"}
                    </StatusPill>
                  </div>
                  {field.options?.length ? <p className="text-xs text-slate-400">Options: {field.options.join(", ")}</p> : null}
                </SectionCard>
              );
            }) : (
              <SectionCard className="p-4">
                <p className="text-sm text-slate-400">No fillable fields were detected. This template remains manual or online-only.</p>
              </SectionCard>
            )}
          </div>
        </PageSection>

        <PageSection title="Matter usage" description="Open a matter forms workspace to generate or review a client-specific draft copy where supported.">
          {drafts.length ? (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <Link key={draft.id} href={`/app/matters/${draft.matterId}/forms` as any}>
                  <SectionCard className="flex items-center justify-between gap-3 p-4 transition hover:bg-white/[0.05]">
                    <div>
                      <p className="text-sm font-semibold text-white">{draft.matter.client.firstName} {draft.matter.client.lastName}</p>
                      <p className="mt-1 text-xs text-slate-500">{draft.matter.title}</p>
                    </div>
                    <StatusPill tone={draft.status === "APPROVED" || draft.status === "PUBLISHED" ? "success" : "warning"}>
                      {draft.status.toLowerCase().replaceAll("_", " ")}
                    </StatusPill>
                  </SectionCard>
                </Link>
              ))}
            </div>
          ) : (
            <SectionCard className="p-4">
              <p className="text-sm text-slate-400">No matter draft PDF has been generated from this template yet.</p>
            </SectionCard>
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}
