import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  campaignStrategyV2Schema,
  type CampaignStrategyCompilation,
  type CampaignStrategyV2,
  type CompiledCampaignCommercialContext,
} from "@/lib/intelligence/campaign-strategy-v2";

export async function createCampaignStrategyV2Draft(input: {
  workspaceId: string;
  campaignExternalId: string;
  profileVersionId: string;
  campaignInput: Json;
  inputHash: string;
  compiledContext: CompiledCampaignCommercialContext;
}) {
  const { supabase: database } = await createAuthenticatedDatabaseClient();
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
  const { supabase: database } = await createAuthenticatedDatabaseClient();
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
  const { supabase: database } = await createAuthenticatedDatabaseClient();
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

export async function getCurrentCampaignStrategyV2Draft(
  workspaceId: string,
  campaignExternalId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("current_strategy_draft_id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .single();
  if (campaignError)
    throw new Error(
      `Could not load V2 Campaign Strategy reference: ${campaignError.message}`,
    );
  if (!campaign.current_strategy_draft_id) return null;
  const { data, error } = await supabase
    .from("campaign_strategy_drafts")
    .select(
      "id,state,contract_version,compiled_draft_json,compiled_context_hash,content_hash,updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", campaign.current_strategy_draft_id)
    .single();
  if (error) throw new Error(`Could not load V2 Campaign Strategy: ${error.message}`);
  return {
    id: data.id,
    state: data.state,
    contractVersion: data.contract_version,
    contextHash: data.compiled_context_hash,
    contentHash: data.content_hash,
    updatedAt: data.updated_at,
    strategy: campaignStrategyV2Schema.parse(data.compiled_draft_json),
  };
}

export async function getCurrentConfirmedCampaignStrategyV2(
  workspaceId: string,
  campaignExternalId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "strategy:campaign_strategy_versions!campaigns_current_strategy_fk(id,version,confirmation_status,strategy,confirmed_at)",
    )
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .maybeSingle();
  if (error) throw new Error(`Could not load confirmed V2 Strategy: ${error.message}`);
  const strategyRow = Array.isArray(data?.strategy) ? data.strategy[0] : data?.strategy;
  if (!strategyRow || strategyRow.confirmation_status !== "confirmed") return null;
  return {
    id: strategyRow.id,
    version: strategyRow.version,
    confirmedAt: strategyRow.confirmed_at,
    strategy: campaignStrategyV2Schema.parse(strategyRow.strategy),
  };
}

export async function getPublishedCampaignProfileContext(
  workspaceId: string,
  selectedOfferingStableKey: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("id,current_version_id")
    .eq("workspace_id", workspaceId)
    .single();
  if (profileError || !profile.current_version_id)
    throw new Error("A published Company Intelligence V3 profile is required.");
  const [
    { data: profileVersion, error: versionError },
    { data: offeringEntity, error: entityError },
    { data: roles, error: rolesError },
  ] = await Promise.all([
    supabase
      .from("company_profile_versions")
      .select("id,intelligence_version,structured_profile")
      .eq("workspace_id", workspaceId)
      .eq("id", profile.current_version_id)
      .single(),
    supabase
      .from("company_offerings")
      .select("id,stable_key")
      .eq("workspace_id", workspaceId)
      .eq("company_profile_id", profile.id)
      .eq("stable_key", selectedOfferingStableKey)
      .maybeSingle(),
    supabase
      .from("company_business_roles")
      .select(
        "role_type,business_model:company_business_models!inner(profile_version_id)",
      )
      .eq("workspace_id", workspaceId)
      .eq("business_model.profile_version_id", profile.current_version_id),
  ]);
  if (versionError || profileVersion.intelligence_version !== "v2") {
    throw new Error("The current Company Profile is not a published V3 version.");
  }
  if (entityError || !offeringEntity)
    throw new Error(
      "The selected offering is not available in the published V3 profile.",
    );
  if (rolesError) throw new Error(`Could not load Company roles: ${rolesError.message}`);
  const { data: offering, error: offeringError } = await supabase
    .from("company_offering_versions")
    .select(
      "id,name,short_description,commercial_mechanics_json,buyer_logic_json,relationship_options_json",
    )
    .eq("workspace_id", workspaceId)
    .eq("profile_version_id", profileVersion.id)
    .eq("company_offering_id", offeringEntity.id)
    .eq("status", "active")
    .single();
  if (offeringError)
    throw new Error(
      `Could not load published offering version: ${offeringError.message}`,
    );
  return {
    profileVersionId: profileVersion.id,
    offeringId: offeringEntity.id,
    offeringStableKey: offeringEntity.stable_key,
    offeringVersion: offering,
    companyRoles: (roles ?? []).map((role) => role.role_type),
  };
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
