import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { prisma } from "@/lib/prisma";
import { getSmsProviderEnv, getSmsProviderStatus } from "@/lib/providers/sms-provider";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { sendSms } from "@/lib/services/sms/send-sms";
import { getSmsConsentSummary } from "@/lib/services/sms/sms-consent";
import { getClickSendDryRunPayload } from "@/lib/services/sms/clicksend-provider";
import { maskPhoneNumber } from "@/lib/services/sms/sms-redaction";
import { getSmsProviderRouter } from "@/lib/services/sms/sms-provider-router";
import { getSmsTemplatePreview } from "@/lib/services/sms/sms-templates";
import { getTwilioDryRunPayload } from "@/lib/services/sms/twilio-provider";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";

export default async function SmsIntegrationPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="SMS integration">
        <PageHeader title="SMS integration unavailable" description="Your company administrator manages SMS provider configuration and reminder testing." />
      </AppShell>
    );
  }

  const [provider, env, settings, consentSummary, audit, recentMessages, usageSummary] = await Promise.all([
    Promise.resolve(getSmsProviderStatus()),
    Promise.resolve(getSmsProviderEnv()),
    getWorkspaceOperationalSettingsView(context.workspace.id),
    getSmsConsentSummary(context.workspace.id),
    prisma.auditEvent.findMany({
      where: {
        workspaceId: context.workspace.id,
        action: {
          in: [
            "sms.provider_tested",
            "sms.sent",
            "sms.failed",
            "sms.template_sent",
            "sms.blocked_no_consent",
            "sms.blocked_rate_limited",
            "sms.opted_out",
            "sms.consent_recorded",
            "sms.provider_not_configured",
            "provider.sms.test_success",
            "provider.sms.test_failed"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.smsMessage.findMany({
      where: { workspaceId: context.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    getSmsProviderRouter().getUsageSummary(context.workspace.id)
  ]);

  async function sendTestSmsAction(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    const phone = String(formData.get("phone") || "").trim();
    if (!phone) return;
    await sendSms({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      to: phone,
      body: `${context.workspace.name}: this is a safe Aria test reminder. Please use your secure portal for any client-specific details.`,
      rateLimitKey: `provider.sms.test:${context.workspace.id}:${phone.slice(-6)}`,
      isAgentAlert: true,
      allowWithoutConsent: true
    });
    revalidatePath("/app/settings/integrations");
    revalidatePath("/app/settings/integrations/sms");
  }

  const clicksendPreview = {
    provider: "clicksend",
    payload: getClickSendDryRunPayload({
      to: "+61400000111",
      body: getSmsTemplatePreview("appointment_reminder")
    })
  };
  const twilioPreview = {
    provider: "twilio",
    payload: getTwilioDryRunPayload({
      to: "+61400000111",
      body: getSmsTemplatePreview("document_reminder")
    })
  };

  return (
    <AppShell title="SMS integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="SMS"
          title="ClickSend and Twilio SMS"
          description="ClickSend is recommended for Australian SMS reminders. Twilio is available for global or advanced messaging setups. SMS messages use generic wording and do not include sensitive visa, identity, health, character, or document details."
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Provider status</h2>
                <p className="mt-1 text-sm text-slate-400">{provider.providerName}</p>
              </div>
              <StatusPill tone={provider.state === "disabled" ? "neutral" : provider.configured ? "success" : "warning"}>
                {provider.state === "disabled" ? "Disabled" : provider.configured ? "Configured" : "Not configured"}
              </StatusPill>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Selected provider: <span className="text-white">{env.provider}</span></p>
              <p>Workspace SMS enabled: <span className="text-white">{settings.smsEnabled ? "Yes" : "No"}</span></p>
              <p>Client consent required: <span className="text-white">{settings.smsClientConsentRequired ? "Yes" : "No"}</span></p>
              <p>Agent alerts enabled: <span className="text-white">{settings.smsAgentAlertsEnabled ? "Yes" : "No"}</span></p>
              <p>Last sent: <span className="text-white">{recentMessages[0]?.sentAt ? recentMessages[0].sentAt.toLocaleString("en-AU") : "Not recorded"}</span></p>
              <p>Last error: <span className="text-white">{provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
              <p>Messages sent today: <span className="text-white">{usageSummary.messagesSentToday}</span></p>
            </div>
            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {provider.requiredSetupSteps.map((step: string) => <li key={step}>{step}</li>)}
              {provider.notes.map((note: string) => <li key={note}>{note}</li>)}
            </ul>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Test SMS</h2>
            <p className="text-sm text-slate-400">Safe test only. This uses a generic reminder body and never includes client-specific migration details.</p>
            <form action={sendTestSmsAction} className="flex flex-col gap-3">
              <input
                type="tel"
                name="phone"
                placeholder="Test phone number"
                className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-slate-500"
              />
              <button
                disabled={!provider.configured}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {provider.configured ? "Send test SMS" : "SMS provider not configured"}
              </button>
            </form>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">ClickSend recommended/default setup</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Username: <span className="text-white">{env.clicksend.usernamePresent ? "Present" : "Missing"}</span></p>
              <p>API key: <span className="text-white">{env.clicksend.apiKeyPresent ? "Present" : "Missing"}</span></p>
              <p>From name: <span className="text-white">{env.clicksend.fromNamePresent ? "Present" : "Missing"}</span></p>
            </div>
            <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{JSON.stringify(clicksendPreview.payload, null, 2)}</pre>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Twilio optional fallback</h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Account SID: <span className="text-white">{env.twilio.accountSidPresent ? "Present" : "Missing"}</span></p>
              <p>Auth token: <span className="text-white">{env.twilio.authTokenPresent ? "Present" : "Missing"}</span></p>
              <p>Messaging service SID: <span className="text-white">{env.twilio.messagingServiceSidPresent ? "Present" : "Missing"}</span></p>
              <p>From number: <span className="text-white">{env.twilio.fromNumberPresent ? "Present" : "Missing"}</span></p>
            </div>
            <pre className="overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{JSON.stringify(twilioPreview.payload, null, 2)}</pre>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Consent status</h2>
            <div className="space-y-3">
              {consentSummary.consents.length ? consentSummary.consents.map((item: (typeof consentSummary.consents)[number]) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{item.client.firstName} {item.client.lastName}</p>
                    <StatusPill tone={item.consentStatus === "CONSENTED" ? "success" : item.consentStatus === "OPTED_OUT" ? "warning" : "neutral"}>
                      {item.consentStatus.replaceAll("_", " ").toLowerCase()}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Phone {maskPhoneNumber(item.client.phone)}</p>
                </div>
              )) : <p className="text-sm text-slate-400">SMS consent not recorded.</p>}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Opt-out status</h2>
            <div className="space-y-3">
              {consentSummary.optOuts.length ? consentSummary.optOuts.map((item: (typeof consentSummary.optOuts)[number]) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{item.client.firstName} {item.client.lastName}</p>
                  <p className="mt-2 text-xs text-slate-400">Phone {maskPhoneNumber(item.client.phone)}</p>
                  <p className="mt-1 text-xs text-slate-400">Recorded {item.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No SMS opt-out recorded.</p>}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Safe template previews</h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">Appointment reminder</p>
                <p className="mt-2 text-slate-300">{getSmsTemplatePreview("appointment_reminder")}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="font-medium text-white">Document reminder</p>
                <p className="mt-2 text-slate-300">{getSmsTemplatePreview("document_reminder")}</p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Redacted audit / event view</h2>
            <div className="space-y-3">
              {audit.length ? audit.map((event: (typeof audit)[number]) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{event.action}</p>
                  <p className="mt-1 text-xs text-slate-400">{event.createdAt.toLocaleString("en-AU")}</p>
                </div>
              )) : <p className="text-sm text-slate-400">No SMS audit events recorded yet.</p>}
            </div>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
