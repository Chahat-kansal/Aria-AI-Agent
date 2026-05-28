import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getWorkspaceBetaSnapshot } from "@/lib/services/beta-dashboard";
import { canManageTeam } from "@/lib/services/roles";

export default async function BetaSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Beta readiness">
        <PageHeader
          title="Beta readiness unavailable"
          description="Your company administrator controls beta readiness, launch gates, and commercial proof settings."
        />
      </AppShell>
    );
  }

  const snapshot = await getWorkspaceBetaSnapshot(context.workspace.id);

  return (
    <AppShell title="Beta readiness">
      <div className="space-y-6">
        <PageHeader
          eyebrow="BETA READINESS"
          title="Controlled beta proof"
          description="This view shows real workspace usage and launch controls. It does not infer customers, revenue, or legal/compliance approval."
          action={<Link href="/app/settings/security/launch-readiness" className="text-sm text-cyan-300 hover:text-white">Open launch readiness</Link>}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Active matters" value={snapshot.valueMetrics.activeMatters} hint="Visible matters in this workspace" accent="violet" />
          <MetricCard label="Documents processed" value={snapshot.valueMetrics.documentsProcessed} hint="Counted from real audit events" accent="cyan" />
          <MetricCard label="Drafts generated" value={snapshot.valueMetrics.draftsGenerated} hint="AI usage events only" accent="emerald" />
          <MetricCard label="Portal invites" value={snapshot.valueMetrics.portalInvitesSent} hint="Invite and portal session activity" accent="amber" />
          <MetricCard label="Estimated hours saved" value={snapshot.valueMetrics.estimatedHoursSaved} hint="Conservative operational estimate" accent="red" />
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Workspace beta posture</h2>
              <p className="mt-1 text-sm text-slate-300">Keep incomplete capabilities visible and honestly labelled. Every workflow remains ready for agent final review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={snapshot.betaModeEnabled ? "warning" : "neutral"}>{snapshot.betaModeEnabled ? "beta mode" : "beta off"}</StatusPill>
              <StatusPill tone={snapshot.allowRealClientUploads ? "warning" : "success"}>{snapshot.allowRealClientUploads ? "real uploads enabled" : "sandbox-first"}</StatusPill>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone={snapshot.launchControlsSummary.clientPortalEnabled ? "success" : "warning"}>client portal</StatusPill>
            <StatusPill tone={snapshot.launchControlsSummary.aiDraftAutofillEnabled ? "success" : "warning"}>AI draft autofill</StatusPill>
            <StatusPill tone={snapshot.launchControlsSummary.pdfFormFillingEnabled ? "success" : "warning"}>PDF filling</StatusPill>
            <StatusPill tone={snapshot.providerReadiness.emailConfigured ? "success" : "warning"}>email</StatusPill>
            <StatusPill tone={snapshot.providerReadiness.smsConfigured ? "success" : "warning"}>SMS</StatusPill>
            <StatusPill tone={snapshot.providerReadiness.ocrConfigured ? "success" : "warning"}>OCR</StatusPill>
            <StatusPill tone={snapshot.providerReadiness.billingConfigured ? "success" : "warning"}>billing</StatusPill>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Onboarding checklist</h2>
          <div className="mt-4 space-y-3">
            {snapshot.onboardingChecklist.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-6 text-slate-400">{item.detail}</p>
                </div>
                <StatusPill tone={item.done ? "success" : "warning"}>{item.done ? "done" : "needs attention"}</StatusPill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
