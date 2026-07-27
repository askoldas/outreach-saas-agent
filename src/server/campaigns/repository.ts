import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type {
  Campaign,
  CampaignStatus,
  CampaignStrategyVersion,
  DiscoveryReport,
} from "@/types/domain";
import type {
  CampaignBriefProposal,
  ConfirmedCampaignBrief,
} from "@/lib/campaign-workflow/contracts";

type CampaignRow = {
  external_id: string;
  name: string;
  objective: string;
  target_geography: string;
  industries: string[];
  company_characteristics: string[];
  preferred_outreach_language: string;
  target_volume: number;
  status: string;
  updated_at: string;
  current_strategy_version_id: string | null;
};
type StrategyRow = { id: string; version: number; strategy: CampaignStrategyVersion };
export type CreateCampaignInput = {
  desiredLeadCount: number;
  exclusions: string[];
  geography: string;
  industryTerms: string[];
  preferredOutreachLanguage: string;
  discoveryLanguages: string[];
  localizedTerms: string[];
  name: string;
  objective: string;
  qualificationCriteria: string[];
  sourceCategories: string[];
  targetSegments: string[];
  terms: string[];
  selectedOfferingId: string | null;
  offeringOverrides: Record<string, unknown>;
};
const campaignSelect = `external_id,name,objective,target_geography,industries,company_characteristics,preferred_outreach_language,target_volume,status,updated_at,current_strategy_version_id`;

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  return hydrate(supabase, workspaceId, (data ?? []) as CampaignRow[]);
}
export async function getCampaign(workspaceId: string, id: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("workspace_id", workspaceId)
    .eq("external_id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load campaign: ${error.message}`);
  if (!data) return null;
  return (await hydrate(supabase, workspaceId, [data as CampaignRow]))[0] ?? null;
}
export async function updateCampaignStatus(
  workspaceId: string,
  id: string,
  status: CampaignStatus,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const persisted = status === "running" ? "active" : status;
  const { error } = await supabase
    .from("campaigns")
    .update({ status: persisted })
    .eq("workspace_id", workspaceId)
    .eq("external_id", id);
  if (error) throw new Error(`Could not update campaign: ${error.message}`);
  const result = await getCampaign(workspaceId, id);
  if (!result) throw new Error("Updated campaign could not be reloaded.");
  return result;
}
export async function updateCampaignDiscoveryState(
  workspaceId: string,
  campaignId: string,
  input: {
    awaitingReview: number;
    latestDiscoveryReport: DiscoveryReport;
    leadCount: number;
    progress: number;
    status: CampaignStatus;
  },
) {
  void workspaceId;
  void campaignId;
  void input;
  throw new Error(
    "Legacy discovery state is unavailable until campaign_runs are migrated.",
  );
}
export async function createCampaign(workspaceId: string, input: CreateCampaignInput) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const externalId = await uniqueId(workspaceId, input.name);
  const strategy = initialStrategy(input);
  const { error } = await supabase.rpc("create_clean_campaign", {
    target_workspace_id: workspaceId,
    campaign_data: {
      externalId,
      name: input.name,
      objective: input.objective,
      geography: input.geography,
      industries: input.industryTerms,
      characteristics: input.targetSegments,
      exclusions: input.exclusions,
      targetVolume: input.desiredLeadCount,
      language: input.preferredOutreachLanguage,
      selectedOfferingId: input.selectedOfferingId,
      targetDescription: JSON.stringify(input.offeringOverrides),
    },
    initial_strategy: strategy,
  });
  if (error) throw new Error(`Could not create campaign: ${error.message}`);
  const result = await getCampaign(workspaceId, externalId);
  if (!result) throw new Error("Created campaign could not be reloaded.");
  return result;
}

export async function saveCampaignBrief(
  workspaceId: string,
  campaignExternalId: string,
  input: {
    profileVersionId: string;
    proposal: CampaignBriefProposal;
    confirmedBrief: ConfirmedCampaignBrief;
    promptVersion: string;
    requestedModel: string;
    actualModel: string;
    fallbackUsed: boolean;
    clarificationAnswer: { answer: string } | null;
  },
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .single();
  if (campaignError)
    throw new Error(`Could not resolve campaign: ${campaignError.message}`);
  const { error } = await supabase.from("campaign_briefs").insert({
    workspace_id: workspaceId,
    campaign_id: campaign.id,
    profile_version_id: input.profileVersionId,
    proposal: input.proposal,
    confirmed_brief: input.confirmedBrief,
    prompt_version: input.promptVersion,
    requested_model: input.requestedModel,
    actual_model: input.actualModel,
    fallback_used: input.fallbackUsed,
    confidence: input.proposal.confidence,
    clarification_answer: input.clarificationAnswer,
  });
  if (error) throw new Error(`Could not save Campaign Brief: ${error.message}`);
}
async function hydrate(
  supabase: Awaited<ReturnType<typeof createAuthenticatedDatabaseClient>>["supabase"],
  workspaceId: string,
  rows: CampaignRow[],
) {
  const ids = rows
    .map((row) => row.current_strategy_version_id)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("campaign_strategy_versions")
    .select("id,version,strategy")
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(`Could not load campaign strategies: ${error.message}`);
  const byId = new Map(((data ?? []) as StrategyRow[]).map((row) => [row.id, row]));
  return rows.map((row) =>
    mapCampaign(row, byId.get(row.current_strategy_version_id ?? "")!),
  );
}
function mapCampaign(row: CampaignRow, strategyRow: StrategyRow): Campaign {
  const strategy = strategyRow.strategy;
  return {
    id: row.external_id,
    name: row.name,
    objective: row.objective,
    geography: row.target_geography,
    industryTerms: row.industries,
    targetSegments: row.company_characteristics,
    progress: 0,
    leadCount: 0,
    desiredLeadCount: row.target_volume,
    awaitingReview: 0,
    status: row.status === "active" ? "running" : (row.status as CampaignStatus),
    lastActivity: row.updated_at,
    preferredOutreachLanguage: row.preferred_outreach_language,
    discoveryLanguages: strategy.searchLanguages,
    warnings: [],
    latestDiscoveryReport: null,
    strategyVersion: strategyRow.version,
    strategy: {
      terms: strategy.searchTerms,
      localizedTerms: strategy.localizedTerms,
      sources: strategy.sourceCategories,
      criteria: strategy.qualificationCriteria,
      exclusions: strategy.exclusions,
      limitations: strategy.limitations,
    },
  };
}
function initialStrategy(input: CreateCampaignInput): CampaignStrategyVersion {
  return {
    id: null,
    version: 0,
    status: "ready",
    targetGeography: input.geography,
    companyTypes: input.targetSegments,
    industries: input.industryTerms,
    characteristics: [],
    relevanceReasons: [input.objective],
    opportunityAssumptions: ["Commercial relevance requires evidence during research"],
    qualificationCriteria: input.qualificationCriteria,
    positiveSignals: [],
    exclusions: input.exclusions,
    contactRoles: ["Relevant decision-maker"],
    contactDepartments: ["Purchasing", "Partnerships"],
    acceptableContactRoutes: [
      "Named business contact",
      "Department email",
      "General business route",
    ],
    searchLanguages: input.discoveryLanguages,
    sourceCategories: input.sourceCategories,
    searchTerms: input.terms,
    localizedTerms: input.localizedTerms,
    limitations: ["New campaign has not run discovery yet."],
    targetCompanyCount: input.desiredLeadCount,
    refinementSummary: ["Initial strategy created from campaign brief."],
  };
}
async function uniqueId(workspaceId: string, name: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "campaign";
  for (let suffix = 0; ; suffix++) {
    const candidate = suffix ? `${base}-${suffix}` : base;
    const { data } = await supabase
      .from("campaigns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("external_id", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
}
