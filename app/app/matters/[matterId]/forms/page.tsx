import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { MatterFormActions } from "@/components/app/matter-form-actions";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterDetailData } from "@/lib/data/workspace-repository";
import { assessMatterCaseSafety } from "@/lib/services/case-safety";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/services/roles";
import { decryptJson } from "@/lib/security/encryption";

export default async function MatterFormsPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Matter Forms">
        <PageHeader title="Matter forms" description="Create or join a workspace to review matter-level official forms." />
      </AppShell>
    );
  }

  const matter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!matter) notFound();
  const safety = await assessMatterCaseSafety(matter.id);

  const [templates, drafts] = await Promise.all([
    prisma.officialFormTemplate.findMany({
      where: {
        OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }],
        subclassCodes: { has: matter.visaSubclass }
      },
      orderBy: [{ supportStatus: "asc" }, { formNumber: "asc" }]
    }),
    prisma.matterOfficialFormDraft.findMany({
      where: { workspaceId: context.workspace.id, matterId: matter.id },
      include: { template: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const draftByTemplateId = new Map(drafts.map((draft) => [draft.templateId, draft]));
  const canEdit = hasPermission(context.user, "can_edit_matters");

  return (
    <AppShell title="Matter Forms">
      <div className="space-y-8">
        <PageHeader
          eyebrow="MATTER FORMS"
          title={`${matter.client.firstName} ${matter.client.lastName} · official forms`}
          description={`${matter.title} · Subclass ${matter.visaSubclass}. Aria never lodges applications, auto-signs, or marks unsupported forms as complete.`}
          action={<Link href="/app/forms" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">Open form library</Link>}
        />

        <AIReviewNotice />

        <SectionCard className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={safety.readyForAgentFinalReview ? "success" : "warning"}>
              {safety.readyForAgentFinalReview ? "Ready for agent final review" : `${safety.hardBlockers.length} hard blocker(s)`}
            </StatusPill>
            <StatusPill tone="info">{safety.softBlockers.length} softer review item(s)</StatusPill>
          </div>
          <p className="text-sm text-slate-300">
            Aria can generate working PDFs now, but approving or publishing a client-visible form copy is blocked until hard blockers are cleared.
          </p>
        </SectionCard>

        <PageSection title="Relevant forms for this matter" description="Supported PDF drafts can be generated where real fillable fields exist. Online-only and manual forms stay explicit.">
          <div className="grid gap-4 xl:grid-cols-2">
            {templates.length ? templates.map((template) => {
              const matterDraft = draftByTemplateId.get(template.id);
              const reviewRows = matterDraft?.fieldValuesJson ? decryptJson<Array<Record<string, unknown>>>(String(matterDraft.fieldValuesJson)) : [];
              const fieldSchema = Array.isArray(template.fieldSchemaJson) ? template.fieldSchemaJson as Array<Record<string, unknown>> : [];
              const storedMappings = template.fieldMappingsJson && typeof template.fieldMappingsJson === "object"
                ? template.fieldMappingsJson as Record<string, string>
                : {};
              const mappedCount = Object.values(storedMappings).filter(Boolean).length;
              return (
                <SectionCard key={template.id} className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">Form {template.formNumber}</p>
                      <p className="mt-1 text-sm text-slate-300">{template.title}</p>
                      <p className="mt-2 text-xs text-slate-500">{template.sourceName ?? "Source not recorded"}{template.sourceUrl ? " · official source stored" : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={template.supportStatus === "FILLABLE_PDF" ? "info" : template.supportStatus === "ONLINE_ONLY" ? "warning" : "warning"}>
                        {template.supportStatus.toLowerCase().replaceAll("_", " ")}
                      </StatusPill>
                      <StatusPill tone={matterDraft?.status === "APPROVED" || matterDraft?.status === "PUBLISHED" ? "success" : matterDraft ? "warning" : "info"}>
                        {matterDraft ? matterDraft.status.toLowerCase().replaceAll("_", " ") : "Not generated"}
                      </StatusPill>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400">
                    {template.supportStatus === "ONLINE_ONLY"
                      ? "Online application / no official fillable PDF draft supported."
                      : template.supportStatus === "MANUAL_ONLY"
                        ? "This PDF is not fillable. Manual review or coordinate mapping is required."
                        : template.supportStatus === "MAPPING_REQUIRED"
                          ? "Field mapping is still required before a reliable draft PDF can be generated."
                          : "Fillable PDF support detected. Agent review remains required for every field."}
                  </p>

                  {matterDraft ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Generated draft</p>
                        <p className="mt-2 text-sm text-white">{matterDraft.generatedFileName ?? "Stored privately"}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mapped fields</p>
                        <p className="mt-2 text-sm text-white">{reviewRows.length}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Template mapping</p>
                      <p className="mt-2 text-sm text-white">{mappedCount}/{fieldSchema.length || 0} fields mapped</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next step</p>
                      <p className="mt-2 text-sm text-white">
                        {mappedCount
                          ? "Generate a matter draft PDF using saved company mappings."
                          : "Open the template and map company PDF fields before generation."}
                      </p>
                    </div>
                  </div>

                  {reviewRows.length ? (
                    <div className="space-y-2">
                      {reviewRows.slice(0, 4).map((row, index) => (
                        <div key={`${template.id}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm">
                          <p className="font-medium text-white">{String(row.fieldName ?? "PDF field")}</p>
                          <p className="mt-1 text-slate-300">{String(row.value ?? "Blank / needs review")}</p>
                          <p className="mt-1 text-xs text-slate-500">{String(row.mappedFieldKey ?? "Mapping required")} · review required</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <MatterFormActions templateId={template.id} matterId={matter.id} draftId={matterDraft?.id} canEdit={canEdit} />
                    {matterDraft?.generatedPdfData ? <a href={`/api/forms/drafts/${matterDraft.id}/download`} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">Download current draft PDF</a> : null}
                    <Link href={`/app/forms/${template.id}` as any} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">Inspect template</Link>
                  </div>
                </SectionCard>
              );
            }) : (
              <SectionCard className="p-4 xl:col-span-2">
                <p className="text-sm text-slate-400">No official or firm-provided form template currently maps to Subclass {matter.visaSubclass}. Sync official forms or upload a firm template first.</p>
              </SectionCard>
            )}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
