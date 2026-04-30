import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/blocks/page-header";
import { StatusChip } from "@/components/app/blocks/status-chip";
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
            <h3 className="font-semibold">Onboarding progress</h3>
            <div className="mt-3 space-y-2 text-sm">
              {onboardingSteps.map((step) => (
                <div key={step.label} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <span>{step.label}</span>
                  <StatusChip label={step.done ? "Completed" : "Pending"} />
                </div>
              ))}
            </div>
          </Card> : null}
          <Card>
            <h3 className="font-semibold">{canManageCompany ? "Workspace profile" : "Personal settings"}</h3>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p>User: <span className="text-[#182033]">{context?.user.name}</span></p>
              <p>Role: <span className="text-[#182033]">{context ? roleLabel(context.user.role) : "User"}</span></p>
              <p>Workspace: <span className="text-[#182033]">{workspace.name}</span></p>
              <p>Workspace portal: <Link href={`/w/${workspace.slug}/login` as any} className="text-accent">/w/{workspace.slug}/login</Link></p>
              {canManageCompany ? (
                <>
                  <p>Plan: <span className="text-[#182033]">{formatEnum(workspace.plan)}</span></p>
                  <p>Created: <span className="text-[#182033]">{formatDate(workspace.createdAt)}</span></p>
                  <Link href="/app/company" className="inline-flex text-accent">Edit company profile</Link>
                  <Link href={"/app/settings/data" as any} className="ml-3 inline-flex text-accent">Data export & privacy controls</Link>
                </>
              ) : (
                <p>Your company administrator manages billing, team access, and company-wide integrations.</p>
              )}
            </div>
          </Card>
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Team members & roles</h3>
            <div className="mt-3 space-y-2">
              {workspace.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <div><p>{user.name}</p><p className="text-xs text-muted">{user.email}</p></div>
                  <StatusChip label={roleLabel(user.role)} />
                </div>
              ))}
            </div>
            <Link href="/app/team" className="mt-3 inline-flex text-sm text-accent">Manage team access</Link>
          </Card> : null}
          <Card>
            <h3 className="font-semibold">AI settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>{aiStatus.provider}</span>
              <ConfigStatus configured={aiStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">{aiStatus.configured ? "AI output remains AI-assisted, source-linked where available, and review required." : `Missing ${aiStatus.missing.join(", ")}.`}</p>
          </Card>
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Production health</h3>
            <div className="mt-3 space-y-2 text-sm">
              {[
                ["OCR provider", ocrStatus.configured, ocrStatus.provider],
                ["Embeddings", embeddingsStatus.configured, embeddingsStatus.provider],
                ["Web research", webResearchStatus.configured, webResearchStatus.provider],
                ["Email", emailStatus.configured, emailStatus.provider],
                ["Storage", storageStatus.configured, storageStatus.provider],
                ["Cron monitor", cronStatus.configured, cronStatus.provider],
                ["Field encryption", encryptionStatus.configured, encryptionStatus.provider]
              ].map(([label, configured, provider]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <div>
                    <p>{label}</p>
                    <p className="text-xs text-muted">{provider}</p>
                  </div>
                  <ConfigStatus configured={Boolean(configured)} />
                </div>
              ))}
            </div>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Authentication</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Session configuration</span>
              <ConfigStatus configured={authStatus.configured && dbStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">{authStatus.configured && dbStatus.configured ? "Database and NextAuth runtime configuration are present." : `Missing ${[...authStatus.missing, ...dbStatus.missing].join(", ")}.`}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Email delivery</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>{emailStatus.provider}</span>
              <ConfigStatus configured={emailStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">{emailStatus.configured ? "Invite emails are sent by the configured provider." : "Invite links remain available in the team UI when email delivery is not configured."}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Live web research</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>{webResearchStatus.provider}</span>
              <ConfigStatus configured={webResearchStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">When configured, Aria can retrieve source-linked official web results. Without provider keys, live research returns a clear configuration message.</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">OCR / document AI</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>{ocrStatus.provider}</span>
              <ConfigStatus configured={ocrStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">{ocrStatus.configured ? "Document extraction uses the configured provider and will still report weak OCR honestly." : `Missing ${ocrStatus.missing.join(", ")}.`}</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Storage settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Persistent storage provider</span>
              <ConfigStatus configured={storageStatus.configured} />
            </div>
            <p className="mt-3 text-xs text-muted">{workspace._count.documents} document metadata records are stored in Postgres. Provider: {storageStatus.provider}. {storageStatus.configured ? "" : `Missing ${storageStatus.missing.join(", ")}.`}</p>
          </Card> : null}
          {hasPermission(context!.user, "can_access_update_monitor") ? <Card>
            <h3 className="font-semibold">Update source settings</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Scheduled ingestion</span>
              <ConfigStatus configured={process.env.OFFICIAL_UPDATE_INGESTION_ENABLED === "true"} />
            </div>
            <div className="mt-3 space-y-2">
              {workspace.officialSources.length ? workspace.officialSources.map((source) => (
                <div key={source.id} className="rounded-lg border border-border p-2 text-xs text-muted">
                  <p className="text-[#182033]">{source.name}</p>
                  <p>{source.sourceType} - {source.active ? "Active" : "Disabled"} - Last fetched {formatDate(source.lastFetchedAt)}</p>
                </div>
              )) : (
                <p className="text-xs text-muted">Global official sources are created when ingestion runs. Workspace-specific sources are not configured.</p>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">Live ingestion can be enabled for official-source monitoring. Every potential impact remains review required.</p>
          </Card> : null}
          {hasPermission(context!.user, "can_access_visa_knowledge") ? <Card>
            <h3 className="font-semibold">Visa knowledge</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Stored official knowledge records</span>
              <span className="text-[#182033]">{visaKnowledgeCount}</span>
            </div>
            <p className="mt-3 text-xs text-muted">Records are refreshed from official/public source-linked retrieval and used for broader subclass selection and Aria grounding.</p>
          </Card> : null}
          {canManageCompany ? <Card>
            <h3 className="font-semibold">Billing</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>Plan management</span>
              <StatusChip label="Coming soon" />
            </div>
            <p className="mt-3 text-xs text-muted">Billing is not active in this phase and no subscription data is shown.</p>
          </Card> : null}
        </section>
      ) : (
        <Card><p className="text-sm text-muted">No workspace settings are available until your user is linked to a workspace.</p></Card>
      )}
    </AppShell>
  );
}
