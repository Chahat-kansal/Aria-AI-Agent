import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getProviderStatuses } from "@/lib/services/provider-status";
import { sendEmail } from "@/lib/services/email/send-email";
import { sendSms } from "@/lib/services/sms/send-sms";

function ProviderCard(props: {
  title: string;
  providerName: string;
  configured: boolean;
  state: string;
  connected: boolean;
  connectionState: string;
  connectedAccountLabel?: string | null;
  lastSuccessfulTestAt?: string | null;
  lastSuccessfulActionAt?: string | null;
  lastSyncAt?: string | null;
  lastErrorSummary?: string | null;
  missingEnv: string[];
  requiredSetupSteps: string[];
  disabledReason?: string | null;
  notes: string[];
  actions?: ReactNode;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{props.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{props.providerName}</p>
        </div>
        <StatusPill tone={props.state === "disabled" ? "neutral" : props.configured && props.connected ? "success" : "warning"}>
          {props.state === "disabled" ? "Disabled" : props.configured && props.connected ? "Configured" : props.configured ? "Needs connection" : "Not configured"}
        </StatusPill>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p>Connection: <span className="text-white">{props.connectionState.replaceAll("_", " ")}</span></p>
        {props.connectedAccountLabel ? <p>Connected account: <span className="text-white">{props.connectedAccountLabel}</span></p> : null}
        <p>Last successful test: <span className="text-white">{props.lastSuccessfulTestAt ? new Date(props.lastSuccessfulTestAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
        <p>Last successful action: <span className="text-white">{props.lastSuccessfulActionAt ? new Date(props.lastSuccessfulActionAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
        <p>Last sync: <span className="text-white">{props.lastSyncAt ? new Date(props.lastSyncAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
        <p>Last error summary: <span className="text-white">{props.lastErrorSummary || "No recent redacted error recorded"}</span></p>
        {props.missingEnv.length ? <p>Missing: <span className="text-white">{props.missingEnv.join(", ")}</span></p> : null}
        {props.disabledReason ? <p>Disabled reason: <span className="text-white">{props.disabledReason}</span></p> : null}
      </div>
      <ul className="space-y-2 text-xs leading-6 text-slate-400">
        {props.notes.map((note) => <li key={note}>{note}</li>)}
        {props.requiredSetupSteps.map((step) => <li key={step}>Setup: {step}</li>)}
      </ul>
      {props.actions}
    </Card>
  );
}

export default async function IntegrationsSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Integrations">
        <PageHeader title="Integrations unavailable" description="Your company administrator manages provider configuration and notification testing." />
      </AppShell>
    );
  }

  const statuses = await getProviderStatuses(context.workspace.id);
  const byKey = Object.fromEntries(statuses.map((item) => [item.key, item]));

  async function sendTestEmail() {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await sendEmail({
      to: context.user.email,
      template: "beta_onboarding",
      templateInput: {
        recipientName: context.user.name,
        workspaceName: context.workspace.name,
        intro: "This is a safe Aria provider test email.",
        footer: "No sensitive client data is included in provider test notifications."
      },
      workspaceId: context.workspace.id,
      userId: context.user.id
    });
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings");
  }

  async function sendTestSms(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    const phone = String(formData.get("phone") || "").trim();
    if (!phone) return;
    await sendSms({
      to: phone,
      body: `${context.workspace.name}: this is a safe Aria test reminder. Please use your secure portal for any client-specific details.`,
      workspaceId: context.workspace.id,
      userId: context.user.id,
      rateLimitKey: `provider.sms.test:${context.workspace.id}:${phone.slice(-6)}`
    });
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings");
  }

  return (
    <AppShell title="Integrations">
      <div className="space-y-8">
        <PageHeader
          eyebrow="INTEGRATIONS"
          title="Provider configuration and status"
          description="These cards show configuration state only. No API keys, tokens, connection strings, or raw URLs are displayed here."
          action={<Link href="/app/settings/security/launch-readiness" className="text-sm text-cyan-300 hover:text-white">Open launch readiness</Link>}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <ProviderCard
            title="Accounting"
            providerName={byKey.accounting.providerName}
            configured={byKey.accounting.configured}
            state={byKey.accounting.state}
            connected={byKey.accounting.connected}
            connectionState={byKey.accounting.connectionState}
            connectedAccountLabel={byKey.accounting.connectedAccountLabel}
            lastSuccessfulTestAt={byKey.accounting.lastSuccessfulTestAt}
            lastSuccessfulActionAt={byKey.accounting.lastSuccessfulActionAt}
            lastSyncAt={byKey.accounting.lastSyncAt}
            lastErrorSummary={byKey.accounting.lastErrorSummary}
            missingEnv={byKey.accounting.missingEnv}
            requiredSetupSteps={byKey.accounting.requiredSetupSteps}
            disabledReason={byKey.accounting.disabledReason}
            notes={byKey.accounting.notes}
            actions={
              <Link href={"/app/settings/integrations/accounting" as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                Open accounting settings
              </Link>
            }
          />
          <ProviderCard
            title="Calendar sync"
            providerName={byKey.calendar.providerName}
            configured={byKey.calendar.configured}
            state={byKey.calendar.state}
            connected={byKey.calendar.connected}
            connectionState={byKey.calendar.connectionState}
            connectedAccountLabel={byKey.calendar.connectedAccountLabel}
            lastSuccessfulTestAt={byKey.calendar.lastSuccessfulTestAt}
            lastSuccessfulActionAt={byKey.calendar.lastSuccessfulActionAt}
            lastSyncAt={byKey.calendar.lastSyncAt}
            lastErrorSummary={byKey.calendar.lastErrorSummary}
            missingEnv={byKey.calendar.missingEnv}
            requiredSetupSteps={byKey.calendar.requiredSetupSteps}
            disabledReason={byKey.calendar.disabledReason}
            notes={byKey.calendar.notes}
            actions={
              <Link href={"/app/settings/integrations/calendar" as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                Open calendar settings
              </Link>
            }
          />
          <ProviderCard
            title="Email"
            providerName={byKey.email.providerName}
            configured={byKey.email.configured}
            state={byKey.email.state}
            connected={byKey.email.connected}
            connectionState={byKey.email.connectionState}
            connectedAccountLabel={byKey.email.connectedAccountLabel}
            lastSuccessfulTestAt={byKey.email.lastSuccessfulTestAt}
            lastSuccessfulActionAt={byKey.email.lastSuccessfulActionAt}
            lastSyncAt={byKey.email.lastSyncAt}
            lastErrorSummary={byKey.email.lastErrorSummary}
            missingEnv={byKey.email.missingEnv}
            requiredSetupSteps={byKey.email.requiredSetupSteps}
            disabledReason={byKey.email.disabledReason}
            notes={byKey.email.notes}
            actions={
              <form action={sendTestEmail}>
                <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
                  Send test email
                </button>
              </form>
            }
          />
          <ProviderCard
            title="Email sync"
            providerName={byKey.email_sync.providerName}
            configured={byKey.email_sync.configured}
            state={byKey.email_sync.state}
            connected={byKey.email_sync.connected}
            connectionState={byKey.email_sync.connectionState}
            connectedAccountLabel={byKey.email_sync.connectedAccountLabel}
            lastSuccessfulTestAt={byKey.email_sync.lastSuccessfulTestAt}
            lastSuccessfulActionAt={byKey.email_sync.lastSuccessfulActionAt}
            lastSyncAt={byKey.email_sync.lastSyncAt}
            lastErrorSummary={byKey.email_sync.lastErrorSummary}
            missingEnv={byKey.email_sync.missingEnv}
            requiredSetupSteps={byKey.email_sync.requiredSetupSteps}
            disabledReason={byKey.email_sync.disabledReason}
            notes={byKey.email_sync.notes}
            actions={
              <Link href={"/app/settings/integrations/email-sync" as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                Open email sync settings
              </Link>
            }
          />
          <ProviderCard
            title="SMS"
            providerName={byKey.sms.providerName}
            configured={byKey.sms.configured}
            state={byKey.sms.state}
            connected={byKey.sms.connected}
            connectionState={byKey.sms.connectionState}
            connectedAccountLabel={byKey.sms.connectedAccountLabel}
            lastSuccessfulTestAt={byKey.sms.lastSuccessfulTestAt}
            lastSuccessfulActionAt={byKey.sms.lastSuccessfulActionAt}
            lastSyncAt={byKey.sms.lastSyncAt}
            lastErrorSummary={byKey.sms.lastErrorSummary}
            missingEnv={byKey.sms.missingEnv}
            requiredSetupSteps={byKey.sms.requiredSetupSteps}
            disabledReason={byKey.sms.disabledReason}
            notes={byKey.sms.notes}
            actions={
              <form action={sendTestSms} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="tel"
                  name="phone"
                  placeholder="Test phone number"
                  className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-slate-500"
                />
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white">
                  Send test SMS
                </button>
              </form>
            }
          />
          {statuses.filter((item) => !["accounting", "calendar", "email", "email_sync", "sms"].includes(item.key)).map((status) => (
            <ProviderCard
              key={status.key}
              title={status.label}
              providerName={status.providerName}
              configured={status.configured}
              state={status.state}
              connected={status.connected}
              connectionState={status.connectionState}
              connectedAccountLabel={status.connectedAccountLabel}
              lastSuccessfulTestAt={status.lastSuccessfulTestAt}
              lastSuccessfulActionAt={status.lastSuccessfulActionAt}
              lastSyncAt={status.lastSyncAt}
              lastErrorSummary={status.lastErrorSummary}
              missingEnv={status.missingEnv}
              requiredSetupSteps={status.requiredSetupSteps}
              disabledReason={status.disabledReason}
              notes={status.notes}
            />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
