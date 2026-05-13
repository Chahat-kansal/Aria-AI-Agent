import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getWorkspaceRows, getAuditRows } from "@/lib/services/platform-admin-data";

export default async function AdminSupportPage({ searchParams }: { searchParams?: { q?: string } }) {
  const query = searchParams?.q?.toLowerCase().trim() ?? "";
  const [workspaces, audit] = await Promise.all([getWorkspaceRows(), getAuditRows({}, 20)]);
  const filtered = query
    ? workspaces.filter((item) => [item.name, item.slug, item.ownerEmail].some((value) => value.toLowerCase().includes(query)))
    : workspaces.slice(0, 12);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SUPPORT" title="Privacy-safe support tools" description="Search workspace metadata, health, flags, and redacted audit. No impersonation and no private client content." />
      <SectionCard>
        <form className="flex flex-wrap gap-3">
          <input name="q" defaultValue={query} placeholder="Search workspace name, slug, or owner email" className="min-w-[280px] flex-1 rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3" />
          <button className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">Search</button>
        </form>
      </SectionCard>
      <section className="grid gap-4 lg:grid-cols-2">
        {filtered.map((workspace) => (
          <SectionCard key={workspace.id}>
            <div className="flex justify-between gap-3">
              <div><p className="font-semibold">{workspace.name}</p><p className="text-xs text-[color:var(--text-tertiary)]">{workspace.slug}</p></div>
              <Link href={`/admin/workspaces/${workspace.id}` as any} className="text-sm text-violet-400">Open</Link>
            </div>
            <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{workspace.counts.users} users · {workspace.counts.matters} matters · {workspace.counts.documents} documents</p>
          </SectionCard>
        ))}
      </section>
      <SectionCard>
        <h2 className="text-lg font-semibold">Recent redacted activity</h2>
        <div className="mt-4 grid gap-2">
          {audit.map((event) => <p key={event.id} className="rounded-2xl bg-[color:var(--surface-soft)] p-3 text-sm">{event.workspaceName} · {event.action}</p>)}
        </div>
      </SectionCard>
    </div>
  );
}
