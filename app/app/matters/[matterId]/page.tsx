import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { AriaAutoprepPanel } from "@/components/app/aria-autoprep-panel";
import { MatterAssignmentForm } from "@/components/app/matter-assignment-form";
import { PortalAccessManager } from "@/components/app/portal-access-manager";
import { AIInsightPanel } from "@/components/ui/ai-insight-panel";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { GradientButton } from "@/components/ui/gradient-button";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SubtleButton } from "@/components/ui/subtle-button";
import { formatDate, formatEnum, getMatterDetailData } from "@/lib/data/workspace-repository";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getMatterIntelligence } from "@/lib/services/aria-intelligence";
import { canManageTeam, hasFirmWideAccess, hasPermission, hasTeamOversight, roleLabel } from "@/lib/services/roles";
import { getAiConfigStatus, getEmailConfigStatus, getEncryptionConfigStatus } from "@/lib/services/runtime-config";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { getSubclassSupport, supportLevelLabel } from "@/lib/services/subclass-support";

export default async function MatterDetailPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return (
      <AppShell title="Matters">
        <div className="space-y-6">
          <PageHeader title="Workspace setup required" description="Create or join a workspace to review matter records." />
        </div>
      </AppShell>
    );
  }

  const matter = await getMatterDetailData(context.workspace.id, params.matterId, context.user);
  if (!matter) notFound();

  const intelligence = await getMatterIntelligence({ matterId: matter.id, user: context.user });
  const openTasks = matter.tasks.filter((task) => task.status !== "DONE").length;
  const openIssues = matter.validationIssues.filter((issue) => issue.resolutionStatus !== "RESOLVED" && issue.resolutionStatus !== "DISMISSED");
  const pendingClientActions = [
    ...matter.intakeRequests.filter((request) => request.status !== "REVIEWED"),
    ...matter.documentRequests.filter((request) => request.status !== "COMPLETED")
  ].length;
  const latestDraft = matter.applicationDrafts[0];
  const canReassign = canManageTeam(context.user) || hasFirmWideAccess(context.user) || hasTeamOversight(context.user);
  const canManageClients = hasPermission(context.user, "can_manage_clients");
  const canEditMatter = hasPermission(context.user, "can_edit_matters");
  const canUseAi = hasPermission(context.user, "can_access_ai");
  const canManageAppointments = hasPermission(context.user, "can_manage_appointments");
  const canRunCrossCheck = hasPermission(context.user, "can_run_cross_check");
  const aiConfigured = getAiConfigStatus().configured;
  const encryptionConfigured = getEncryptionConfigStatus().configured;
  const hasExtractedDocuments = matter.documents.some((document) => document.extractionStatus === "EXTRACTED");
  const assignableUsers = canReassign
    ? await prisma.user.findMany({
      where: { workspaceId: context.workspace.id, status: { not: "DISABLED" } },
      orderBy: { name: "asc" }
    })
    : [];
  const [portalLinks, relatedForms, appointmentCount, documentRequestCount, intakeCount, settingsView] = await Promise.all([
    canManageClients
      ? prisma.clientPortalAccessToken.findMany({
          where: { workspaceId: context.workspace.id, matterId: matter.id },
          include: { createdByUser: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" }
        })
      : Promise.resolve([]),
    prisma.officialFormTemplate.findMany({
      where: {
        OR: [{ workspaceId: context.workspace.id }, { workspaceId: null }],
        subclassCodes: { has: matter.visaSubclass }
      },
      orderBy: { formNumber: "asc" }
    }),
    prisma.appointment.count({ where: { workspaceId: context.workspace.id, matterId: matter.id } }),
    prisma.documentRequest.count({ where: { workspaceId: context.workspace.id, matterId: matter.id } }),
    prisma.clientIntakeRequest.count({ where: { workspaceId: context.workspace.id, matterId: matter.id } }),
    getWorkspaceOperationalSettingsView(context.workspace.id)
  ]);
  const emailConfigured = getEmailConfigStatus().configured;
  const subclassSupport = getSubclassSupport(matter.visaSubclass);
  const workflowItems = [
    {
      label: "Upload documents for this matter",
      href: `/app/documents?matterId=${matter.id}`,
      status: matter.documents.length ? "completed" : canEditMatter && encryptionConfigured ? "ready" : "blocked",
      reason: matter.documents.length
        ? `${matter.documents.length} document(s) uploaded.`
        : !canEditMatter
          ? "You do not have permission to upload matter documents."
          : !encryptionConfigured
            ? "Document upload is blocked until APP_FIELD_ENCRYPTION_KEY is configured."
            : "Secure upload is available."
    },
    {
      label: "Review extracted evidence",
      href: `/app/matters/${matter.id}/review`,
      status: hasExtractedDocuments ? "ready" : "blocked",
      reason: hasExtractedDocuments ? "Open the evidence-backed extraction dashboard." : "Upload documents or run extraction to build the review dashboard."
    },
    {
      label: "Run AI Draft Autofill",
      href: `/app/matters/${matter.id}/draft`,
      status: subclassSupport.aiDraftAutofill && canUseAi && aiConfigured && matter.documents.length ? "ready" : "blocked",
      reason: !subclassSupport.aiDraftAutofill
        ? `Field-level draft autofill is not configured for this subclass. Current support level: ${supportLevelLabel(subclassSupport.supportLevel)}.`
        : !matter.documents.length
          ? "Upload documents before running draft autofill."
          : !canUseAi
            ? "AI draft autofill requires Aria AI access."
            : !aiConfigured
              ? "AI is not configured. Add OPENAI_API_KEY to enable draft autofill."
              : "Run source-backed mapping from uploaded documents."
    },
    {
      label: "Review application draft",
      href: `/app/matters/${matter.id}/draft`,
      status: latestDraft ? "ready" : subclassSupport.fieldLevelDraftKeys ? "ready" : "blocked",
      reason: latestDraft ? `Latest draft status: ${formatEnum(latestDraft.status)}.` : subclassSupport.fieldLevelDraftKeys ? "Open the draft workspace to create or review the matter draft." : `This matter currently uses ${supportLevelLabel(subclassSupport.supportLevel)} until field-level draft keys are configured.`
    },
    {
      label: "Open checklist",
      href: `/app/matters/${matter.id}/checklist`,
      status: "ready",
      reason: `${matter.checklistItems.length} checklist item(s) recorded.`
    },
    {
      label: "Open official forms",
      href: `/app/matters/${matter.id}/forms`,
      status: relatedForms.length ? "ready" : "blocked",
      reason: relatedForms.length ? `${relatedForms.length} relevant template(s) found for Subclass ${matter.visaSubclass}.` : "No official or firm-provided form template is mapped to this subclass yet."
    },
    {
      label: "Generate client portal link",
      href: `#client-portal-access`,
      status: canManageClients ? "ready" : "blocked",
      reason: canManageClients ? `${portalLinks.length} portal link(s) already issued.` : "You do not have permission to manage client portal links."
    },
    {
      label: "Send document request",
      href: `/app/document-requests?matterId=${matter.id}`,
      status: hasPermission(context.user, "can_send_client_requests") ? "ready" : "blocked",
      reason: hasPermission(context.user, "can_send_client_requests") ? `${documentRequestCount} document request record(s) exist for this matter.` : "You do not have permission to send client requests."
    },
    {
      label: "Send intake request",
      href: `/app/intake?matterId=${matter.id}`,
      status: hasPermission(context.user, "can_send_client_requests") ? "ready" : "blocked",
      reason: hasPermission(context.user, "can_send_client_requests") ? `${intakeCount} intake request record(s) exist for this matter.` : "You do not have permission to send intake requests."
    },
    {
      label: "Book appointment / view appointments",
      href: `/app/appointments?matterId=${matter.id}`,
      status: canManageAppointments ? "ready" : "blocked",
      reason: canManageAppointments ? `${appointmentCount} appointment record(s) linked to this matter.${settingsView.appointmentAvailability.length ? " Availability windows are configured." : " Availability is not configured; request fallback applies."}` : "You do not have permission to manage appointments."
    },
    {
      label: "Export secure client folder",
      href: `/api/settings/data/export-folder?matterId=${matter.id}`,
      status: hasPermission(context.user, "can_export_data") ? "ready" : "blocked",
      reason: hasPermission(context.user, "can_export_data") ? "Streams a secure ZIP export through the app." : "You do not have permission to export secure client folders."
    },
    {
      label: "Final cross-check",
      href: `/app/matters/${matter.id}/draft`,
      status: canRunCrossCheck ? "ready" : "blocked",
      reason: canRunCrossCheck ? "Open the draft workspace to run the final submission-readiness cross-check." : "You do not have permission to run final cross-checks."
    }
  ];

  return (
    <AppShell title="Matters">
      <div className="space-y-8">
        <PageHeader
          eyebrow="MATTER WORKBENCH"
          title={`${matter.client.firstName} ${matter.client.lastName}`}
          description={matter.title}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="info">{matter.visaSubclass}</StatusPill>
              <StatusPill tone={subclassSupport.supportLevel === "FULL_FIELD_AUTOFILL" ? "success" : "warning"}>
                {supportLevelLabel(subclassSupport.supportLevel)}
              </StatusPill>
              <StatusPill>{formatEnum(matter.stage)}</StatusPill>
              <StatusPill tone={matter.readinessScore >= 80 ? "success" : matter.readinessScore >= 60 ? "warning" : "danger"}>
                {matter.readinessScore}% ready
              </StatusPill>
            </div>
          }
        />

        <AIInsightPanel
          eyebrow="Aria matter intelligence"
          title={intelligence.matterHealth}
          summary={intelligence.summary}
          statusLabel="Review required"
          action={
            matter.visaSubclass === "500" ? (
              <Link href={`/app/matters/${matter.id}/review` as any}>
                <GradientButton>Review extracted evidence</GradientButton>
              </Link>
            ) : (
              <Link href={`/app/matters/${matter.id}/checklist`}>
                <GradientButton>Open checklist</GradientButton>
              </Link>
            )
          }
        >
          <AIReviewNotice />
          <div className="grid gap-3 md:grid-cols-3">
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Next best action</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.nextBestAction}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Client follow-up</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.clientFollowUpSuggestion}</p>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Final review note</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{intelligence.finalReviewNote}</p>
            </SectionCard>
            <SectionCard className="p-4 md:col-span-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Subclass support</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{subclassSupport.label}: {subclassSupport.notes}</p>
            </SectionCard>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Evidence used</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {intelligence.groundedFacts.length
                  ? intelligence.groundedFacts.slice(0, 6).map((fact) => <li key={fact}>{fact}</li>)
                  : <li>No matter evidence summary is available yet.</li>}
              </ul>
            </SectionCard>
            <SectionCard className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Recommended next actions</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {intelligence.recommendedActions.length
                  ? intelligence.recommendedActions.slice(0, 6).map((action) => <li key={`${action.entityId}-${action.title}`}>{action.title}</li>)
                  : <li>No recommended action is stored yet.</li>}
              </ul>
            </SectionCard>
          </div>
        </AIInsightPanel>

        <PageSection
          eyebrow="AUTOMATION"
          title="Aria autoprep agent"
          description="Aria can run the low-risk prep work on its own, then wait for explicit approval before higher-impact matter actions."
        >
          <SectionCard className="p-5">
            <AriaAutoprepPanel matterId={matter.id} canRun={canEditMatter} />
          </SectionCard>
        </PageSection>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Readiness" value={`${matter.readinessScore}%`} hint="Current submission-readiness score." accent={matter.readinessScore >= 80 ? "emerald" : matter.readinessScore >= 60 ? "amber" : "red"} />
          <MetricCard label="Documents" value={matter.documents.length} hint="Files linked to this matter." accent="cyan" />
          <MetricCard label="Validation issues" value={openIssues.length} hint="Open issues still needing review." accent={openIssues.length ? "red" : "emerald"} />
          <MetricCard label="Pending client actions" value={pendingClientActions} hint="Intake, doc requests, and linked review items." accent={pendingClientActions ? "amber" : "emerald"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <PageSection eyebrow="WORKFLOW" title="Matter workflow" description="Every step below either performs a real action, opens a real route, or tells you honestly why it is blocked.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {workflowItems.map((item) => (
                  <Link key={item.label} href={item.href as any} className={item.status === "blocked" ? "pointer-events-none" : ""}>
                    <SectionCard className={`h-full p-4 transition ${item.status === "blocked" ? "opacity-70" : "hover:bg-white/[0.05]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <StatusPill tone={item.status === "completed" ? "success" : item.status === "ready" ? "info" : "warning"}>{item.status}</StatusPill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{item.reason}</p>
                    </SectionCard>
                  </Link>
                ))}
              </div>
            </PageSection>

            <PageSection title="Matter review signals" description="Current evidence, draft, and checklist signals grounded in stored workspace data.">
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Evidence gaps</h3>
                    <StatusPill tone={intelligence.evidenceGaps.length ? "warning" : "success"}>
                      {intelligence.evidenceGaps.length ? "Needs attention" : "Covered"}
                    </StatusPill>
                  </div>
                  <ul className="space-y-2">
                    {intelligence.evidenceGaps.length ? intelligence.evidenceGaps.map((item) => (
                      <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">No obvious evidence gap is currently visible from the checklist and document links.</li>}
                  </ul>
                </SectionCard>

                <SectionCard className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Draft blockers</h3>
                    <StatusPill tone={intelligence.draftWeaknesses.length ? "danger" : "success"}>
                      {intelligence.draftWeaknesses.length ? "Review required" : "Stable"}
                    </StatusPill>
                  </div>
                  <ul className="space-y-2">
                    {intelligence.draftWeaknesses.length ? intelligence.draftWeaknesses.map((item) => (
                      <li key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400">No major draft blocker is visible from the current field review state.</li>}
                  </ul>
                </SectionCard>

                <SectionCard className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Risk warnings</h3>
                    <StatusPill tone={intelligence.riskWarnings.length ? "warning" : "success"}>
                      {intelligence.riskWarnings.length ? `${intelligence.riskWarnings.length} flagged` : "No current flags"}
                    </StatusPill>
                  </div>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {intelligence.riskWarnings.length ? intelligence.riskWarnings.map((item) => (
                      <li key={item} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-300">{item}</li>
                    )) : <li className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-400 md:col-span-2">No additional risk warnings are visible for this matter right now.</li>}
                  </ul>
                </SectionCard>
              </div>
            </PageSection>

            <PageSection title="Operational queues" description="The key matter-linked queues, current tasks, and update impacts in one place.">
              <div className="grid gap-4 md:grid-cols-3">
                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Checklist</h3>
                  {matter.checklistItems.length ? matter.checklistItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.required ? "Required" : "Optional"} - {formatEnum(item.status)}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No checklist items are recorded for this matter yet.</p>}
                </SectionCard>

                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Open issues</h3>
                  {openIssues.length ? openIssues.slice(0, 4).map((issue) => (
                    <div key={issue.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{issue.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{issue.severity} - {formatEnum(issue.resolutionStatus)}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No unresolved validation issues are recorded.</p>}
                </SectionCard>

                <SectionCard className="space-y-3 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Update impacts</h3>
                  {matter.impacts.length ? matter.impacts.slice(0, 4).map((impact) => (
                    <div key={impact.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-sm font-medium text-white">{impact.officialUpdate.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{impact.actionRequired ?? "Review required."}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">No official update impact is linked yet.</p>}
                </SectionCard>
              </div>
            </PageSection>
          </div>

          <div className="space-y-6">
            <PageSection title="Key details" description="Core deadlines, ownership, and matter metadata.">
              <SectionCard className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned agent</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.assignedToUser.name ?? matter.assignedToUser.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{roleLabel(matter.assignedToUser.role)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Matter reference</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.matterReference ?? matter.id.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-slate-400">Client ref {matter.client.clientReference ?? matter.client.id.slice(0, 8)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current visa</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.currentVisaStatus || "Not set"}</p>
                    <p className="mt-1 text-xs text-slate-400">Expiry {formatDate(matter.currentVisaExpiry)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Application status</p>
                    <p className="mt-2 text-sm font-medium text-white">{matter.applicationStatus || "Not set"}</p>
                    <p className="mt-1 text-xs text-slate-400">Critical deadline {formatDate(matter.criticalDeadline)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lodgement target</p>
                    <p className="mt-2 text-sm font-medium text-white">{formatDate(matter.lodgementTargetDate)}</p>
                    <p className="mt-1 text-xs text-slate-400">Status {formatEnum(matter.status)}</p>
                  </div>
                </div>
              </SectionCard>
            </PageSection>

            {canReassign ? (
              <PageSection title="Assignment">
                <SectionCard>
                  <MatterAssignmentForm
                    matterId={matter.id}
                    currentAssigneeId={matter.assignedToUserId}
                    users={assignableUsers.map((user) => ({ id: user.id, name: user.name, email: user.email, roleLabel: roleLabel(user.role) }))}
                  />
                </SectionCard>
              </PageSection>
            ) : null}

            <PageSection title="Timeline">
              <SectionCard className="space-y-3">
                {matter.timelineEvents.length ? matter.timelineEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{event.title}</p>
                      <p className="text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                    </div>
                    {event.description ? <p className="mt-2 text-sm text-slate-300">{event.description}</p> : null}
                  </div>
                )) : <p className="text-sm text-slate-400">No timeline events are recorded yet.</p>}
              </SectionCard>
            </PageSection>

            <PageSection title="Client portal access" description="Share only scoped portal links. Raw links are shown only once at generation time.">
              <SectionCard className="space-y-3">
                <p id="client-portal-access" className="text-sm text-slate-300">Clients use secure links sent by their migration agent. Email delivery is {emailConfigured ? "configured" : "not configured, so links must be copied manually"}.</p>
                {canManageClients ? (
                  <PortalAccessManager
                    clientId={matter.clientId}
                    matterId={matter.id}
                    clientEmail={matter.client.email}
                    emailConfigured={emailConfigured}
                    initialLinks={portalLinks.map((link) => ({
                      id: link.id,
                      label: link.label,
                      purpose: link.purpose,
                      createdAt: link.createdAt,
                      expiresAt: link.expiresAt,
                      revokedAt: link.revokedAt,
                      lastViewedAt: link.lastViewedAt,
                      status: link.revokedAt ? "revoked" : link.expiresAt < new Date() ? "expired" : "active",
                      createdBy: link.createdByUser ? { name: link.createdByUser.name, email: link.createdByUser.email } : null
                    }))}
                  />
                ) : <p className="text-xs text-slate-500">You do not have permission to manage client portal access for this matter.</p>}
              </SectionCard>
            </PageSection>

            <PageSection title="Documents, forms, and exports">
              <SectionCard className="space-y-3">
                <p className="text-sm text-slate-300">Use the matter-specific routes below for secure evidence, official forms, generated documents, and export tasks.</p>
                <div className="grid gap-2">
                  <Link href={`/app/documents?matterId=${matter.id}` as any}><SubtleButton className="w-full justify-start">Upload documents for this matter</SubtleButton></Link>
                  <Link href={`/app/matters/${matter.id}/review` as any}><SubtleButton className="w-full justify-start">Review extracted evidence</SubtleButton></Link>
                  <Link href={`/app/matters/${matter.id}/forms` as any}><SubtleButton className="w-full justify-start">Open official forms</SubtleButton></Link>
                  <Link href={`/app/matters/${matter.id}/generated-documents` as any}><SubtleButton className="w-full justify-start">Generate migration documents</SubtleButton></Link>
                  <a href={`/api/settings/data/export-folder?matterId=${matter.id}`}><SubtleButton className="w-full justify-start">Export secure client folder</SubtleButton></a>
                </div>
                {matter.visaSubclass === "500" ? <Link href={`/app/matters/${matter.id}/draft`}><GradientButton className="w-full">Run AI Draft Autofill</GradientButton></Link> : null}
                {latestDraft ? <p className="text-xs text-slate-500">Latest draft status: {formatEnum(latestDraft.status)}</p> : <p className="text-xs text-slate-500">No matter draft exists yet. Open the draft workspace to start review.</p>}
              </SectionCard>
            </PageSection>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
