import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { getAgentOperationsSnapshot } from "@/lib/services/agent-operations";

export default async function OperationsPage() {
  const context = await requireCurrentWorkspaceContext();
  const snapshot = await getAgentOperationsSnapshot(context.user as any);

  return (
    <AppShell title="Operations">
      <div className="space-y-6">
        <PageHeader
          eyebrow="OPERATIONS"
          title="Deadline command centre"
          description="Real workflow signals for reminders, document chasing, matter health, and value proof. Every action remains ready for agent final review."
          action={<Link href={"/app/settings/integrations" as any} className="text-sm text-cyan-300 hover:text-white">Open integrations</Link>}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Documents processed" value={snapshot.valueMetrics.documentsProcessed} hint="Counted from real document upload events" accent="cyan" />
          <MetricCard label="Draft actions" value={snapshot.valueMetrics.draftsGenerated} hint="AI usage events in visible scope" accent="violet" />
          <MetricCard label="Pending confirmations" value={snapshot.valueMetrics.pendingConfirmations} hint="Client review requests still open" accent={snapshot.valueMetrics.pendingConfirmations ? "amber" : "emerald"} />
          <MetricCard label="Estimated hours saved" value={snapshot.valueMetrics.estimatedHoursSaved} hint="Conservative operational estimate from recorded events" accent="emerald" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PageSection title="Upcoming deadlines" description="Operational reminders only. Legal deadlines still require agent verification.">
            <div className="space-y-3">
              {snapshot.deadlineAlerts.length ? snapshot.deadlineAlerts.slice(0, 8).map((item) => (
                <Card key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.client}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.title} · Subclass {item.visaSubclass}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {item.criticalDays !== null ? `Critical deadline in ${item.criticalDays} day(s). ` : ""}
                        {item.expiryDays !== null ? `Current visa expiry in ${item.expiryDays} day(s). ` : ""}
                        {item.dueRequest !== null ? `Document request due in ${item.dueRequest} day(s).` : ""}
                      </p>
                    </div>
                    <StatusPill tone={item.readinessScore >= 75 ? "success" : item.readinessScore >= 50 ? "warning" : "danger"}>{item.readinessScore}% ready</StatusPill>
                  </div>
                </Card>
              )) : <EmptyState title="No deadline alerts in scope" description="Critical matter dates, visa expiry dates, and request due dates will appear here automatically." />}
            </div>
          </PageSection>

          <PageSection title="Client response tracker" description="See which clients still need follow-up on uploads, confirmations, or appointments.">
            <div className="space-y-3">
              {snapshot.clientResponseTracker.length ? snapshot.clientResponseTracker.slice(0, 8).map((item) => (
                <Card key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.client}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.matterTitle}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {item.dueDate ? `Due ${item.dueDate.toLocaleDateString("en-AU")}. ` : ""}
                        {item.reminderSentAt ? `Last reminder ${item.reminderSentAt.toLocaleDateString("en-AU")}.` : "No reminder recorded yet."}
                      </p>
                    </div>
                    <StatusPill tone={item.status === "OVERDUE" ? "danger" : item.status === "VIEWED" ? "warning" : "info"}>{item.status.toLowerCase()}</StatusPill>
                  </div>
                </Card>
              )) : <EmptyState title="No client follow-up queue" description="Pending document requests will appear here once matters start using the client request workflow." />}
            </div>
          </PageSection>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PageSection title="Matter health score" description="Evidence completeness, blockers, confirmations, and flagged documents in one view.">
            <div className="space-y-3">
              {snapshot.matterHealth.length ? snapshot.matterHealth.slice(0, 8).map((item) => (
                <Card key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.client}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.title} · Subclass {item.visaSubclass}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {item.missingDocs} missing docs · {item.blockerCount} blockers · {item.pendingConfirmation} pending confirmations · {item.documentQualityRisk} flagged docs
                      </p>
                    </div>
                    <StatusPill tone={item.score >= 75 ? "success" : item.score >= 50 ? "warning" : "danger"}>{item.score}</StatusPill>
                  </div>
                </Card>
              )) : <EmptyState title="No matter health data yet" description="Matter health appears after clients, documents, and review flows are created." />}
            </div>
          </PageSection>

          <PageSection title="Appointments and reminders" description="Safe client follow-up channels should stay generic and secure.">
            <div className="space-y-3">
              {snapshot.appointments.length ? snapshot.appointments.slice(0, 8).map((item) => (
                <Card key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.client}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.meetingType}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.startsAt.toLocaleString("en-AU")}</p>
                    </div>
                    <StatusPill tone={item.status === "CONFIRMED" ? "success" : "warning"}>{item.status.toLowerCase()}</StatusPill>
                  </div>
                </Card>
              )) : <EmptyState title="No appointment queue" description="Appointment requests and reminders will appear here when the portal booking flow is used." />}
            </div>
          </PageSection>
        </div>
      </div>
    </AppShell>
  );
}
