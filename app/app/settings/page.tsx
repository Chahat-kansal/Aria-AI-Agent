import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { formatDate, formatEnum, getSettingsData } from "@/lib/data/workspace-repository";
import { prisma } from "@/lib/prisma";
import { canManageTeam, hasPermission, roleLabel } from "@/lib/services/roles";
import {
  getAiConfigStatus,
  getAuthConfigStatus,
  getCronConfigStatus,
  getDatabaseConfigStatus,
  getEmailConfigStatus,
  getEmbeddingsConfigStatus,
  getEncryptionConfigStatus,
  getOcrConfigStatus,
  getStorageConfigStatus,
  getWebResearchConfigStatus
} from "@/lib/services/runtime-config";

function ConfigStatus({ configured }: { configured: boolean }) {
  return <StatusChip label={configured ? "Configured" : "Not configured"} />;
}

export default async function SettingsPage() {
  const context = await getCurrentWorkspaceContext();
  const workspace = context ? await getSettingsData(context.workspace.id) : null;
  const visaKnowledgeCount = await prisma.visaKnowledgeRecord.count();
  const canManageCompany = context ? canManageTeam(context.user) : false;
  const authStatus = getAuthConfigStatus();
  const dbStatus = getDatabaseConfigStatus();
  const aiStatus = getAiConfigStatus();
  const emailStatus = getEmailConfigStatus();
  const storageStatus = getStorageConfigStatus();
  const ocrStatus = getOcrConfigStatus();
  const embeddingsStatus = getEmbeddingsConfigStatus();
  const webResearchStatus = getWebResearchConfigStatus();
  const cronStatus = getCronConfigStatus();
  const encryptionStatus = getEncryptionConfigStatus();
  const onboardingSteps = workspace ? [
    { label: "Company profile completed", done: Boolean(workspace.name && workspace.slug) },
    { label: "Invite team", done: workspace.users.length > 1 },
    { label: "Create first matter", done: workspace._count.matters > 0 },
    { label: "Configure AI", done: aiStatus.configured },
    { label: "Configure email", done: emailStatus.configured },
    { label: "Configure storage", done: storageStatus.configured },
    { label: "Configure visa knowledge research", done: webResearchStatus.configured }
  ] : [];

  return (
    <AppShell title="Settings">
      <PageHeader title="Workspace Settings" subtitle="Review real workspace, team, and production configuration state. Unconfigured integrations show their setup state honestly." />
      {workspace ? (
        <section className="grid gap-4 md:grid-cols-2">
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Onboarding progress</h3>
            <div className="mt-4 space-y-3 text-sm">
              {onboardingSteps.map((step) => (
                <div key={step.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="text-slate-200">{step.label}</span>
                  <StatusChip label={step.done ? "Completed" : "Pending"} />
                </div>
              ))}
            </div>
          </Card> : null}
          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">{canManageCompany ? "Workspace profile" : "Personal settings"}</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>User: <span className="text-white">{context?.user.name}</span></p>
              <p>Role: <span className="text-white">{context ? roleLabel(context.user.role) : "User"}</span></p>
              <p>Workspace: <span className="text-white">{workspace.name}</span></p>
              <p>Workspace portal: <Link href={`/w/${workspace.slug}/login` as any} className="text-cyan-300 transition hover:text-white">/w/{workspace.slug}/login</Link></p>
              {canManageCompany ? (
                <>
                  <p>Plan: <span className="text-white">{formatEnum(workspace.plan)}</span></p>
                  <p>Created: <span className="text-white">{formatDate(workspace.createdAt)}</span></p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/app/company" className="inline-flex text-cyan-300 transition hover:text-white">Edit company profile</Link>
                    <Link href={"/app/settings/data" as any} className="inline-flex text-cyan-300 transition hover:text-white">Data export & privacy controls</Link>
                  </div>
                </>
              ) : (
                <p>Your company administrator manages billing, team access, and company-wide integrations.</p>
              )}
            </div>
          </Card>
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Team members & roles</h3>
            <div className="mt-4 space-y-3">
              {workspace.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div><p className="text-white">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div>
                  <StatusChip label={roleLabel(user.role)} />
                </div>
              ))}
            </div>
            <Link href="/app/team" className="mt-4 inline-flex text-sm text-cyan-300 transition hover:text-white">Manage team access</Link>
          </Card> : null}
          <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">AI settings</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>{aiStatus.provider}</span>
              <ConfigStatus configured={aiStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">{aiStatus.configured ? "AI output remains AI-assisted, source-linked where available, and review required." : `Missing ${aiStatus.missing.join(", ")}.`}</p>
          </Card>
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Production health</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ["OCR provider", ocrStatus.configured, ocrStatus.provider],
                ["Embeddings", embeddingsStatus.configured, embeddingsStatus.provider],
                ["Web research", webResearchStatus.configured, webResearchStatus.provider],
                ["Email", emailStatus.configured, emailStatus.provider],
                ["Storage", storageStatus.configured, storageStatus.provider],
                ["Cron monitor", cronStatus.configured, cronStatus.provider],
                ["Field encryption", encryptionStatus.configured, encryptionStatus.provider]
              ].map(([label, configured, provider]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div>
                    <p className="text-white">{label}</p>
                    <p className="text-xs text-slate-400">{provider}</p>
                  </div>
                  <ConfigStatus configured={Boolean(configured)} />
                </div>
              ))}
            </div>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Authentication</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>Session configuration</span>
              <ConfigStatus configured={authStatus.configured && dbStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">{authStatus.configured && dbStatus.configured ? "Database and NextAuth runtime configuration are present." : `Missing ${[...authStatus.missing, ...dbStatus.missing].join(", ")}.`}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Email delivery</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>{emailStatus.provider}</span>
              <ConfigStatus configured={emailStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">{emailStatus.configured ? "Invite emails are sent by the configured provider." : "Invite links remain available in the team UI when email delivery is not configured."}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Live web research</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>{webResearchStatus.provider}</span>
              <ConfigStatus configured={webResearchStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">When configured, Aria can retrieve source-linked official web results. Without provider keys, live research returns a clear configuration message.</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">OCR / document AI</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>{ocrStatus.provider}</span>
              <ConfigStatus configured={ocrStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">{ocrStatus.configured ? "Document extraction uses the configured provider and will still report weak OCR honestly." : `Missing ${ocrStatus.missing.join(", ")}.`}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Storage settings</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>Persistent storage provider</span>
              <ConfigStatus configured={storageStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-slate-400">{workspace._count.documents} document metadata records are stored in Postgres. Provider: {storageStatus.provider}. {storageStatus.configured ? "" : `Missing ${storageStatus.missing.join(", ")}.`}</p>
          </Card> : null}
          {hasPermission(context!.user, "can_access_update_monitor") ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Update source settings</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>Scheduled ingestion</span>
              <ConfigStatus configured={process.env.OFFICIAL_UPDATE_INGESTION_ENABLED === "true"} />
            </div>
            <div className="mt-4 space-y-3">
              {workspace.officialSources.length ? workspace.officialSources.map((source) => (
                <div key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                  <p className="text-white">{source.name}</p>
                  <p>{source.sourceType} - {source.active ? "Active" : "Disabled"} - Last fetched {formatDate(source.lastFetchedAt)}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-400">Global official sources are created when ingestion runs. Workspace-specific sources are not configured.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-400">Live ingestion can be enabled for official-source monitoring. Every potential impact remains review required.</p>
          </Card> : null}
          {hasPermission(context!.user, "can_access_visa_knowledge") ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Visa knowledge</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>Stored official knowledge records</span>
              <span className="text-white">{visaKnowledgeCount}</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">Records are refreshed from official/public source-linked retrieval and used for broader subclass selection and Aria grounding.</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="text-xl font-semibold tracking-tight text-white">Billing</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
              <span>Plan management</span>
              <StatusChip label="Coming soon" />
            </div>
            <p className="mt-3 text-xs text-slate-400">Billing is not active in this phase and no subscription data is shown.</p>
          </Card> : null}
        </section>
      ) : (
        <EmptyState
          title="No workspace settings available"
          description="Workspace settings appear once your user is linked to a workspace."
          action={<SecondaryButton>Refresh workspace link</SecondaryButton>}
        />
      )}
    </AppShell>
  );
}
