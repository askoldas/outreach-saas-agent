import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { CampaignStrategyVersion } from "@/types/domain";

type Row = {
  id: string;
  version: number;
  status: CampaignStrategyVersion["status"];
  strategy: unknown;
};

export async function getCurrentCampaignStrategy(
  workspaceId: string,
  externalId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("current_strategy_version_id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error)
    throw new Error(`Could not load campaign strategy reference: ${error.message}`);
  if (!campaign?.current_strategy_version_id) return null;
  const { data, error: strategyError } = await supabase
    .from("campaign_strategy_versions")
    .select("id,version,status,strategy")
    .eq("workspace_id", workspaceId)
    .eq("id", campaign.current_strategy_version_id)
    .single();
  if (strategyError)
    throw new Error(`Could not load Campaign Strategy: ${strategyError.message}`);
  return map(data as Row);
}

function map(row: Row): CampaignStrategyVersion {
  const value = row.strategy as CampaignStrategyVersion;
  return { ...value, id: row.id, version: row.version, status: row.status };
}
