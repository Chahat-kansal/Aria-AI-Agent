import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getAuditRows, safeJson } from "@/lib/services/platform-admin-data";
import { requirePlatformAdmin, auditPlatformAdminAction } from "@/lib/services/platform-admin";

export default async function AdminAuditPage() {
  const admin = await requirePlatformAdmin();
  await auditPlatformAdminAction(admin.user, "platform.audit.viewed", {});
  const events = await getAuditRows({}, 120);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AUDIT" title="Redacted platform audit" description="Platform-wide audit metadata is redacted before display. Tokens, hashes, document text, draft values, and snippets are not shown." />
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
              <tr><th className="p-3">Time</th><th className="p-3">Workspace</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Redacted metadata</th></tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-white/5 align-top">
                  <td className="p-3 text-xs">{event.createdAt.toLocaleString("en-AU")}</td>
                  <td className="p-3">{event.workspaceName}</td>
                  <td className="p-3 text-xs">{event.actorEmail}<br />{event.actorRole}</td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3 text-xs">{event.entityType}<br />{event.entityId}</td>
                  <td className="p-3"><pre className="max-w-md whitespace-pre-wrap text-xs">{safeJson(event.metadata)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

