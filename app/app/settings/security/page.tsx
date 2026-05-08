import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getSecurityHealth } from "@/lib/services/security-health";

function Flag({ label, configured, description }: { label: string; configured: boolean; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{label}</p>
        <StatusPill tone={configured ? "success" : "danger"}>{configured ? "Configured" : "Attention required"}</StatusPill>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export default async function SettingsSecurityPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Security">
        <PageHeader title="Security settings unavailable" description="Your company administrator controls security configuration and incident handling." />
      </AppShell>
    );
  }

  const health = await getSecurityHealth(context.workspace.id);
  return (
    <AppShell title="Security">
      <div className="space-y-6">
        <PageHeader
          eyebrow="ARIA SECURITY VAULT"
          title="Security and document protection"
          description="Configuration health only is shown here. Secret values are never displayed. AI-assisted output always remains review required."
          action={
            <div className="flex flex-wrap gap-2">
              <a href="/app/settings/security/launch-readiness" className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">Launch readiness</a>
              <a href="/app/settings/security/incidents" className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">Incident register</a>
            </div>
          }
        />

        {!health.encryption.configured ? (
          <Card>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Critical: APP_FIELD_ENCRYPTION_KEY is missing or invalid. Configure a 32 byte base64 key or 64 hex chars before allowing controlled production document uploads.
              <div className="mt-3 space-y-2 text-xs leading-6 text-red-100/90">
                <p>Generate APP_FIELD_ENCRYPTION_KEY:</p>
                <code className="block rounded-xl border border-red-400/20 bg-black/20 px-3 py-2 text-[11px] text-red-50">
                  {'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'}
                </code>
                <p>Generate CRON_SECRET:</p>
                <code className="block rounded-xl border border-red-400/20 bg-black/20 px-3 py-2 text-[11px] text-red-50">
                  {'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'}
                </code>
              </div>
            </div>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Flag label="Field encryption" configured={health.encryption.configured} description="AES-256-GCM application-level encryption for sensitive stored values." />
          <Flag label="Authentication" configured={health.auth.configured} description="NextAuth session secret and base URL." />
          <Flag label="Database" configured={health.database.configured} description="Primary Postgres connection for workspace data." />
          <Flag label="Private storage" configured={health.storage.configured} description="Secure document storage provider without public raw file URLs." />
          <Flag label="AI provider" configured={health.ai.configured} description="AI assistance only runs when provider secrets are configured." />
          <Flag label="Email provider" configured={health.email.configured} description="Secure invite and portal communication delivery." />
          <Flag label="Cron" configured={health.cron.configured} description="Protected cron secret for background monitoring jobs." />
          <Flag label="Web research" configured={health.webResearch.configured} description="Source-linked migration intelligence collection." />
          <Flag label="OCR / document AI" configured={health.ocr.configured} description="Readable text extraction for uploads, with honest weak-OCR states." />
        </section>

        <Card>
          <h3 className="text-lg font-semibold text-white">Operational signals</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last migration intel sweep</p>
              <p className="mt-2 text-sm text-white">{health.lastMigrationIntelSweep ? health.lastMigrationIntelSweep.toLocaleString("en-AU") : "No completed sweep yet"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last audit log event</p>
              <p className="mt-2 text-sm text-white">{health.lastAuditLogEvent ? health.lastAuditLogEvent.toLocaleString("en-AU") : "No audit event recorded yet"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Last security incident</p>
              <p className="mt-2 text-sm text-white">{health.lastSecurityIncident ? health.lastSecurityIncident.toLocaleString("en-AU") : "No incident logged yet"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Document protection</p>
              <p className="mt-2 text-sm text-white">{health.documentProtectionStatus ? "Private storage plus application encryption active" : "Review storage and encryption configuration"}</p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
