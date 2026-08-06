import { campaignStrategyV2Schema } from "@/lib/intelligence/campaign-strategy-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { z } from "zod";

const campaignRunContextSchema = z
  .object({
    id: z.string().min(1),
    campaign_id: z.string().min(1),
    strategy_version_id: z.string().min(1),
    workflow_version: z.string().min(1),
    created_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const strategyVersionContextSchema = z
  .object({
    id: z.string().min(1),
    campaign_id: z.string().min(1),
    version: z.number().int().positive(),
    confirmation_status: z.string().min(1),
    confirmed_at: z.iso.datetime({ offset: true }).nullable(),
    confirmed_by: z.string().min(1).nullable(),
    strategy: z.unknown(),
  })
  .strict();

export async function loadInitialDiscoveryContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: campaignRun, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,campaign_id,strategy_version_id,workflow_version,created_at")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not load V2 discovery Campaign Run: ${runError.message}`);
  const parsedCampaignRun = campaignRunContextSchema.parse(campaignRun);
  if (parsedCampaignRun.workflow_version !== "v2")
    throw new Error("V2 discovery cannot execute a non-V2 Campaign Run.");

  const { data: strategyVersion, error: strategyError } = await supabase
    .from("campaign_strategy_versions")
    .select(
      "id,campaign_id,version,confirmation_status,confirmed_at,confirmed_by,strategy",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", parsedCampaignRun.strategy_version_id)
    .single();
  if (strategyError)
    throw new Error(`Could not load confirmed V2 Strategy: ${strategyError.message}`);
  const parsedStrategyVersion = strategyVersionContextSchema.parse(strategyVersion);
  if (
    parsedStrategyVersion.campaign_id !== parsedCampaignRun.campaign_id ||
    parsedStrategyVersion.confirmation_status !== "confirmed"
  )
    throw new Error("V2 discovery requires the run's confirmed Strategy version.");
  if (!parsedStrategyVersion.confirmed_at)
    throw new Error("V2 discovery requires a timestamped Strategy confirmation.");
  const strategy = campaignStrategyV2Schema.parse(parsedStrategyVersion.strategy);
  if (strategy.status !== "confirmed")
    throw new Error("V2 discovery requires a frozen confirmed Strategy payload.");
  return {
    campaignRunId: parsedCampaignRun.id,
    campaignInternalId: parsedCampaignRun.campaign_id,
    campaignRunCreatedAt: new Date(parsedCampaignRun.created_at).toISOString(),
    ...(parsedStrategyVersion.confirmed_by
      ? { confirmedByUserId: parsedStrategyVersion.confirmed_by }
      : {}),
    strategy,
    strategyConfirmedAt: new Date(parsedStrategyVersion.confirmed_at).toISOString(),
    strategyVersionId: parsedStrategyVersion.id,
    strategyVersionNumber: parsedStrategyVersion.version,
    workspaceId: input.workspaceId,
  };
}

export async function loadEnabledDiscoveryProviderIds(workspaceId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("workspace_intelligence_settings")
    .select("enabled_providers")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`Could not load V2 provider settings: ${error.message}`);
  return normalizeProviderIds(data?.enabled_providers ?? ["web"]);
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
