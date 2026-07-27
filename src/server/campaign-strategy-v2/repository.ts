import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  campaignStrategyV2Schema,
  type CampaignStrategyCompilation,
  type CampaignStrategyV2,
  type CompiledCampaignCommercialContext,
} from "@/lib/intelligence/campaign-strategy-v2";

type StrategyRpcName =
  | "create_campaign_strategy_v2_draft"
  | "compile_campaign_strategy_v2_draft"
  | "confirm_campaign_strategy_v2";

type StrategyDatabaseClient = {
  rpc(
    name: StrategyRpcName,
    args: Record<string, Json | string | null>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function createCampaignStrategyV2Draft(input: {
  workspaceId: string;
  campaignExternalId: string;
  profileVersionId: string;
  campaignInput: Json;
  inputHash: string;
  compiledContext: CompiledCampaignCommercialContext;
}) {
  const database = await strategyDatabase();
  const { data, error } = await database.rpc("create_campaign_strategy_v2_draft", {
    target_workspace_id: input.workspaceId,
    target_campaign_external_id: input.campaignExternalId,
    target_profile_version_id: input.profileVersionId,
    target_input: input.campaignInput,
    target_input_hash: input.inputHash,
    target_compiled_context: input.compiledContext as unknown as Json,
    target_compiled_context_hash: input.compiledContext.contextHash,
  });
  if (error)
    throw new Error(`Could not create Campaign Strategy V2 draft: ${error.message}`);
  return draftIdentity(data);
}

export async function persistCampaignStrategyV2Compilation(input: {
  workspaceId: string;
  strategyDraftId: string;
  compilation: CampaignStrategyCompilation;
}) {
  const database = await strategyDatabase();
  const { data, error } = await database.rpc("compile_campaign_strategy_v2_draft", {
    target_workspace_id: input.workspaceId,
    target_strategy_draft_id: input.strategyDraftId,
    target_compilation: input.compilation as unknown as Json,
  });
  if (error)
    throw new Error(`Could not compile Campaign Strategy V2 draft: ${error.message}`);
  return draftIdentity(data);
}

export async function confirmCampaignStrategyV2(input: {
  workspaceId: string;
  strategyDraftId: string;
}) {
  const database = await strategyDatabase();
  const { data, error } = await database.rpc("confirm_campaign_strategy_v2", {
    target_workspace_id: input.workspaceId,
    target_strategy_draft_id: input.strategyDraftId,
  });
  if (error) throw new Error(`Could not confirm Campaign Strategy V2: ${error.message}`);
  const row = objectValue(data);
  const strategy = campaignStrategyV2Schema.parse(row.strategy);
  return {
    id: stringValue(row.id, "Confirmed strategy ID"),
    version: numberValue(row.version, "Confirmed strategy version"),
    strategy,
  };
}

export function parsePersistedCampaignStrategyV2(value: unknown): CampaignStrategyV2 {
  return campaignStrategyV2Schema.parse(value);
}

async function strategyDatabase() {
  const { supabase } = await createAuthenticatedDatabaseClient();
  return supabase as unknown as StrategyDatabaseClient;
}

function draftIdentity(value: unknown) {
  const row = objectValue(value);
  return {
    id: stringValue(row.id, "Campaign Strategy draft ID"),
    state: stringValue(row.state, "Campaign Strategy draft state"),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Campaign Strategy persistence returned an invalid record.");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value) throw new Error(`${label} is missing.`);
  return value;
}

function numberValue(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} is missing.`);
  }
  return value;
}
