import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getProviderStatuses } from "@/lib/services/provider-status";

export default async function AdminIntegrationsPage() {
  const providers = await getProviderStatuses();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="INTEGRATIONS"
        title="Integration hub"
        description="Central integration posture for Aria. This view shows configuration and connection status only, with redacted error summaries and setup steps."
      />

      <SectionCard>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {providers.map((provider) => (
            <div key={provider.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{provider.label}</p>
                  <p className="mt-1 text-slate-300">{provider.providerName}</p>
                </div>
                <StatusPill tone={provider.state === "disabled" ? "neutral" : provider.configured && provider.connected ? "success" : "warning"}>
                  {provider.state === "disabled" ? "Disabled" : provider.configured && provider.connected ? "Configured" : provider.configured ? "Needs connection" : "Not configured"}
                </StatusPill>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-400">
                <p>Connection: <span className="text-white">{provider.connectionState.replaceAll("_", " ")}</span></p>
                {provider.connectedAccountLabel ? <p>Connected account: <span className="text-white">{provider.connectedAccountLabel}</span></p> : null}
                <p>Last successful action: <span className="text-white">{provider.lastSuccessfulActionAt ? new Date(provider.lastSuccessfulActionAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
                <p>Last sync: <span className="text-white">{provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleString("en-AU") : "Not recorded"}</span></p>
                <p>Last error: <span className="text-white">{provider.lastErrorSummary || "No recent redacted error recorded"}</span></p>
                {provider.disabledReason ? <p>Disabled reason: <span className="text-white">{provider.disabledReason}</span></p> : null}
              </div>
              {provider.missingEnv.length ? (
                <div className="mt-3 rounded-2xl bg-white/[0.03] p-3 text-xs text-slate-400">
                  Missing environment values: <span className="text-white">{provider.missingEnv.join(", ")}</span>
                </div>
              ) : null}
              {provider.requiredSetupSteps.length ? (
                <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-400">
                  {provider.requiredSetupSteps.map((step) => <li key={step}>{step}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
