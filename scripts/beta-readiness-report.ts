import { getProviderStatuses } from "@/lib/services/provider-status";
import { getSubclassSupportSummary } from "@/lib/services/subclass-support";
import { getPlatformBetaSnapshot } from "@/lib/services/beta-dashboard";

async function main() {
  const subclassSummary = getSubclassSupportSummary();
  const providers = await getProviderStatuses();

  try {
    const snapshot = await getPlatformBetaSnapshot();
    console.log(JSON.stringify({
      status: "ok",
      generatedAt: snapshot.generatedAt,
      providerConfigured: providers.filter((provider) => provider.configured).length,
      providerNotConfigured: providers.filter((provider) => !provider.configured).map((provider) => provider.label),
      subclassSummary,
      betaWorkspaces: snapshot.workspaces.filter((workspace) => workspace.betaModeEnabled).length,
      sandboxFirstWorkspaces: snapshot.workspaces.filter((workspace) => !workspace.allowRealClientUploads).length,
      totalEstimatedHoursSaved: Number(snapshot.workspaces.reduce((total, workspace) => total + workspace.valueMetrics.estimatedHoursSaved, 0).toFixed(1)),
      notes: [
        "This report uses real audit activity and launch controls where available.",
        "It does not infer paying customers, revenue, or legal approval."
      ]
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      status: "database_unavailable",
      subclassSummary,
      providerConfigured: providers.filter((provider) => provider.configured).length,
      providerNotConfigured: providers.filter((provider) => !provider.configured).map((provider) => provider.label),
      error: error instanceof Error ? error.message : String(error),
      notes: [
        "Beta readiness reporting is partially blocked because the database connection is unavailable in this environment.",
        "No usage or customer metrics were inferred."
      ]
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
