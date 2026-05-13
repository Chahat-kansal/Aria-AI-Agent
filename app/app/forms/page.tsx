import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { FormsSyncAction } from "@/components/app/forms-sync-action";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";
import { canManageTeam, hasPermission, scopedMatterWhere } from "@/lib/services/roles";

function supportLabel(status: string) {
  switch (status) {
    case "FILLABLE_PDF":
      return "Fillable PDF";
    case "ONLINE_ONLY":
      return "Online only";
    case "MANUAL_ONLY":
      return "Manual review";
    default:
      return "Mapping required";
  }
}

export default async function FormsPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Official Forms">
        <PageHeader title="Official forms" description="Create or join a workspace to manage official and firm-provided form templates." />
      </AppShell>
    );
  }

  const [templates, matters, drafts] = await Promise.all([
    prisma.officialFormTemplate.findMany({
      where: { OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }] },
      orderBy: [{ lifecycleStatus: "asc" }, { formNumber: "asc" }],
      take: 120
    }),
    prisma.matter.findMany({
      where: scopedMatterWhere(context.user),
      include: { client: true },
      orderBy: { updatedAt: "desc" },
      take: 6
    }),
    prisma.matterOfficialFormDraft.findMany({
      where: { workspaceId: context.workspace.id },
      include: { matter: { include: { client: true } }, template: true },
      orderBy: { updatedAt: "desc" },
      take: 8
    })
  ]);

  const canSync = canManageTeam(context.user);
  const canEditMatters = hasPermission(context.user, "can_edit_matters");

  return (
    <AppShell title="Official Forms">
      <div className="space-y-8">
        <PageHeader
          eyebrow="OFFICIAL FORMS"
          title="Official PDF forms and matter drafts"
          description="Aria syncs official Department source URLs where supported, detects fillable PDF fields, and keeps unsupported or online-only forms honest."
          action={<FormsSyncAction canSync={canSync} />}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <SectionCard className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Templates</p>
            <p className="mt-3 text-3xl font-semibold text-white">{templates.length}</p>
            <p className="mt-2 text-sm text-slate-400">Official and firm-provided templates currently stored privately.</p>
          </SectionCard>
          <SectionCard className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Fillable PDFs</p>
            <p className="mt-3 text-3xl font-semibold text-white">{templates.filter((item) => item.supportStatus === "FILLABLE_PDF").length}</p>
            <p className="mt-2 text-sm text-slate-400">Templates where real AcroForm fields were detected.</p>
          </SectionCard>
          <SectionCard className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Matter form drafts</p>
            <p className="mt-3 text-3xl font-semibold text-white">{drafts.length}</p>
            <p className="mt-2 text-sm text-slate-400">Generated draft PDFs remain review-required and never lodge applications.</p>
          </SectionCard>
        </section>

        <PageSection title="Form library" description="Every template below is either privately stored, online-only, or flagged for manual review. No fake successful filling is shown.">
          {templates.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {templates.map((template) => (
                <Link key={template.id} href={`/app/forms/${template.id}` as any} className="block">
                  <SectionCard className="space-y-4 p-5 transition hover:bg-white/[0.05]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">Form {template.formNumber}</p>
                        <p className="mt-1 text-sm text-slate-300">{template.title}</p>
                        <p className="mt-2 text-xs text-slate-500">{template.sourceName ?? "Source not recorded"}{template.sourceUrl ? " · official URL stored" : ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill tone={template.lifecycleStatus === "CURRENT" ? "success" : template.lifecycleStatus === "NEEDS_REVIEW" ? "warning" : "danger"}>
                          {template.lifecycleStatus.toLowerCase().replaceAll("_", " ")}
                        </StatusPill>
                        <StatusPill tone={template.supportStatus === "FILLABLE_PDF" ? "info" : template.supportStatus === "ONLINE_ONLY" ? "warning" : "warning"}>
                          {supportLabel(template.supportStatus)}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.subclassCodes.map((code) => <StatusPill key={`${template.id}-${code}`}>Subclass {code}</StatusPill>)}
                    </div>
                    <p className="text-xs text-slate-500">
                      {template.supportStatus === "ONLINE_ONLY"
                        ? "Online application / no official fillable PDF draft supported."
                        : template.supportStatus === "MANUAL_ONLY"
                          ? "This PDF is stored privately but requires manual review."
                          : template.supportStatus === "MAPPING_REQUIRED"
                            ? "Template stored. Field mapping review is still required."
                            : "Fillable PDF support detected. Review every field before use."}
                    </p>
                  </SectionCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No official forms are stored yet"
              description="Sync official forms to download supported Department PDFs, detect fillable fields, and mark online-only or manual-only forms honestly."
            />
          )}
        </PageSection>

        <PageSection title="Matter workflows" description="Open the matter-level form workspace instead of guessing which template belongs to a client matter.">
          {matters.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {matters.map((matter) => (
                <Link key={matter.id} href={`/app/matters/${matter.id}/forms` as any}>
                  <SectionCard className="space-y-2 p-4 transition hover:bg-white/[0.05]">
                    <p className="text-base font-semibold text-white">{matter.client.firstName} {matter.client.lastName}</p>
                    <p className="text-sm text-slate-400">{matter.title} · Subclass {matter.visaSubclass}</p>
                    <p className="text-xs text-slate-500">{canEditMatters ? "Open supported official forms for this matter." : "You can view matter form status in your current scope."}</p>
                  </SectionCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No matters in scope yet" description="Create a matter first, then open its matter forms workspace to map official or firm-provided templates." />
          )}
        </PageSection>

        <PageSection title="Recent form drafts" description="Only real, matter-linked PDF drafts are shown here.">
          {drafts.length ? (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <SectionCard key={draft.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{draft.template.formNumber} · {draft.template.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{draft.matter.client.firstName} {draft.matter.client.lastName} · {draft.matter.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={draft.status === "APPROVED" || draft.status === "PUBLISHED" ? "success" : draft.status === "READY_FOR_REVIEW" ? "warning" : "info"}>
                      {draft.status.toLowerCase().replaceAll("_", " ")}
                    </StatusPill>
                    <Link href={`/app/matters/${draft.matterId}/forms` as any} className="text-sm font-medium text-cyan-300 hover:text-cyan-200">Open matter forms</Link>
                  </div>
                </SectionCard>
              ))}
            </div>
          ) : (
            <EmptyState title="No matter form drafts yet" description="Generate a draft PDF from a supported form template inside a matter workspace to see it here." />
          )}
        </PageSection>
      </div>
    </AppShell>
  );
}
