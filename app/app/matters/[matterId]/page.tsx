import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getMatterDetailData } from "@/lib/data/workspace-repository";

const tabs = ["Overview", "Documents", "Field Review", "Validation", "Tasks", "Updates", "AI Assistant"];

export default async function MatterDetailPage({ params }: { params: { matterId: string } }) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return <AppShell title="Matters"><PageHeader title="Workspace setup required" subtitle="Create or join a workspace to review matter records." /></AppShell>;

  const matter = await getMatterDetailData(context.workspace.id, params.matterId);
  if (!matter) notFound();

  const openTasks = matter.tasks.filter((task) => task.status !== "DONE").length;
  const openIssues = matter.validationIssues.filter((issue) => issue.resolutionStatus !== "RESOLVED" && issue.resolutionStatus !== "DISMISSED");

  return (
    <AppShell title="Matters">
      <PageHeader title={`${matter.client.firstName} ${matter.client.lastName} · ${matter.title}`} subtitle="AI-assisted matter workspace with source-linked review controls." />
      <Card>
        <div className="flex flex-wrap gap-2 text-sm">{tabs.map((tab, idx) => <span key={tab} className={`rounded-full px-3 py-1 ${idx === 0 ? "bg-accent/20 text-accent" : "bg-[#111a2b] text-muted"}`}>{tab}</span>)}</div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Status</p><p className="font-medium">{formatEnum(matter.status)}</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Stage</p><p className="font-medium">{formatEnum(matter.stage)}</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Readiness</p><p className="font-medium">{matter.readinessScore}%</p></div>
          <div className="rounded-xl border border-border p-3"><p className="text-muted">Lodgement target</p><p className="font-medium">{formatDate(matter.lodgementTargetDate)}</p></div>
        </div>
      </Card>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-semibold">Checklist summary</h3>
          {matter.checklistItems.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">
              {matter.checklistItems.slice(0, 6).map((item) => <li key={item.id}>{item.label}: {item.status}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No checklist items are recorded for this matter yet.</p>
          )}
        </Card>
        <Card>
          <h3 className="font-semibold">Flagged issues</h3>
          {openIssues.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">{openIssues.slice(0, 4).map((issue) => <li key={issue.id}>{issue.title}</li>)}</ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No unresolved validation issues are recorded.</p>
          )}
        </Card>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Card><h3 className="font-semibold">Documents</h3><p className="mt-2 text-sm text-muted">{matter.documents.length} linked files</p></Card>
        <Card>
          <h3 className="font-semibold">Potential impacts</h3>
          <p className="mt-2 text-sm text-muted">{matter.impacts.length} update matches</p>
          {matter.impacts[0] ? (
            <p className="mt-2 text-xs text-muted">{matter.impacts[0].officialUpdate.title}: {matter.impacts[0].actionRequired ?? "Review required."}</p>
          ) : null}
        </Card>
        <Card><h3 className="font-semibold">Open tasks</h3><p className="mt-2 text-sm text-muted">{openTasks} active tasks</p></Card>
      </section>

      {matter.visaSubclass === "500" ? (
        <Card className="mt-4">
          <h3 className="font-semibold">Subclass 500 draft workflow</h3>
          <p className="mt-2 text-sm text-muted">Open the source-linked draft application workspace for document mapping, validation, evidence packaging, and client review preparation.</p>
          <Link href={`/app/matters/${matter.id}/draft`} className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-sm text-white">Open draft workflow</Link>
        </Card>
      ) : null}
    </AppShell>
  );
}
