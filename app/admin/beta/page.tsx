import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getPlatformBetaSnapshot } from "@/lib/services/beta-dashboard";

export default async function AdminBetaPage() {
  const snapshot = await getPlatformBetaSnapshot();
  const betaWorkspaces = snapshot.workspaces.filter((workspace) => workspace.betaModeEnabled);
  const totalHoursSaved = snapshot.workspaces.reduce((total, workspace) => total + workspace.valueMetrics.estimatedHoursSaved, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="BETA"
        title="Controlled beta health"
        description="Commercial proof is built from real workspace events and configuration state. No customer revenue or legal/compliance claims are inferred here."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Beta workspaces" value={betaWorkspaces.length} hint={`${snapshot.workspaces.length} total visible workspaces`} accent="violet" />
        <MetricCard label="Tracked audit events" value={snapshot.totalAuditEvents} hint="Used for usage and value reporting" accent="cyan" />
        <MetricCard label="Estimated hours saved" value={Number(totalHoursSaved.toFixed(1))} hint="Conservative estimate from recorded events only" accent="emerald" />
        <MetricCard label="Full autofill workflows" value={snapshot.subclassSummary.byLevel.FULL_FIELD_AUTOFILL} hint="Shown honestly alongside partial and checklist support" accent="amber" />
      </section>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Provider readiness summary</h2>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Configured providers improve delivery, but missing providers stay visible and honest.</p>
          </div>
          <Link href="/admin/system-health" className="text-sm text-violet-400">Open system health</Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            snapshot.providerReadiness.email,
            snapshot.providerReadiness.sms,
            snapshot.providerReadiness.ocr,
            snapshot.providerReadiness.billing,
            snapshot.providerReadiness.analytics
          ].map((provider) => (
            <div key={provider.key} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{provider.label}</p>
                <StatusPill tone={provider.configured ? "success" : "warning"}>{provider.configured ? "configured" : "not configured"}</StatusPill>
              </div>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{provider.providerName}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Workspace beta proof</h2>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Each workspace row shows launch controls, recorded usage, and honest blockers.</p>
          </div>
          <Link href="/admin/subclass-support" className="text-sm text-violet-400">Open subclass support</Link>
        </div>
        <div className="mt-4 grid gap-3">
          {snapshot.workspaces.map((workspace) => (
            <div key={workspace.workspaceId} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{workspace.workspaceName}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{workspace.workspaceSlug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={workspace.betaModeEnabled ? "warning" : "neutral"}>{workspace.betaModeEnabled ? "beta mode" : "beta off"}</StatusPill>
                  <StatusPill tone={workspace.allowRealClientUploads ? "warning" : "success"}>{workspace.allowRealClientUploads ? "real uploads enabled" : "sandbox-first"}</StatusPill>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                <MetricCard label="Matters" value={workspace.valueMetrics.activeMatters} accent="violet" />
                <MetricCard label="Docs processed" value={workspace.valueMetrics.documentsProcessed} accent="cyan" />
                <MetricCard label="Drafts generated" value={workspace.valueMetrics.draftsGenerated} accent="emerald" />
                <MetricCard label="Portal invites" value={workspace.valueMetrics.portalInvitesSent} accent="amber" />
                <MetricCard label="Hours saved" value={workspace.valueMetrics.estimatedHoursSaved} accent="red" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone={workspace.launchControlsSummary.clientPortalEnabled ? "success" : "warning"}>client portal</StatusPill>
                <StatusPill tone={workspace.launchControlsSummary.aiDraftAutofillEnabled ? "success" : "warning"}>AI draft autofill</StatusPill>
                <StatusPill tone={workspace.launchControlsSummary.pdfFormFillingEnabled ? "success" : "warning"}>PDF filling</StatusPill>
                <StatusPill tone={workspace.providerReadiness.emailConfigured ? "success" : "warning"}>email</StatusPill>
                <StatusPill tone={workspace.providerReadiness.ocrConfigured ? "success" : "warning"}>OCR</StatusPill>
              </div>
              <div className="mt-4 grid gap-2">
                {workspace.onboardingChecklist.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 px-3 py-2 text-sm">
                    <div>
                      <p>{item.label}</p>
                      <p className="text-xs text-[color:var(--text-tertiary)]">{item.detail}</p>
                    </div>
                    <StatusPill tone={item.done ? "success" : "warning"}>{item.done ? "done" : "needs attention"}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
