import { campaignStrategyV2Schema } from "@/lib/intelligence/campaign-strategy-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function loadInitialDiscoveryContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: campaignRun, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,campaign_id,strategy_version_id,workflow_version")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not load V2 discovery Campaign Run: ${runError.message}`);
  if (campaignRun.workflow_version !== "v2")
    throw new Error("V2 discovery cannot execute a non-V2 Campaign Run.");

  const [{ data: strategyVersion, error: strategyError }, settingsResult] =
    await Promise.all([
      supabase
        .from("campaign_strategy_versions")
        .select("id,campaign_id,confirmation_status,confirmed_at,strategy")
        .eq("workspace_id", input.workspaceId)
        .eq("id", campaignRun.strategy_version_id)
        .single(),
      supabase
        .from("workspace_intelligence_settings")
        .select("enabled_providers")
        .eq("workspace_id", input.workspaceId)
        .maybeSingle(),
    ]);
  if (strategyError)
    throw new Error(`Could not load confirmed V2 Strategy: ${strategyError.message}`);
  if (
    strategyVersion.campaign_id !== campaignRun.campaign_id ||
    strategyVersion.confirmation_status !== "confirmed"
  )
    throw new Error("V2 discovery requires the run's confirmed Strategy version.");
  if (settingsResult.error)
    throw new Error(
      `Could not load V2 provider settings: ${settingsResult.error.message}`,
    );
  return {
    campaignInternalId: campaignRun.campaign_id,
    enabledProviderIds: normalizeProviderIds(
      settingsResult.data?.enabled_providers ?? ["web"],
    ),
    strategy: campaignStrategyV2Schema.parse(strategyVersion.strategy),
    strategyConfirmedAt:
      strategyVersion.confirmed_at ?? new Date(0).toISOString(),
    strategyVersionId: strategyVersion.id,
  };
}

function normalizeProviderIds(values: string[]) {
  return [
    ...new Set(
      values.map((value) => {
        if (value === "web") return "web_search";
        return value;
      }),
    ),
  ];
}
