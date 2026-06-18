import { campaigns as sampleCampaigns } from "@/data/mock/prospecting";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Campaign, CampaignStatus } from "@/types/domain";

type CampaignRow = {
  awaiting_review: number;
  external_id: string;
  geography: string;
  language: string;
  last_activity_label: string;
  lead_count: number;
  name: string;
  objective: string;
  offer_external_id: string;
  progress: number;
  status: CampaignStatus;
  strategy_criteria: string[];
  strategy_exclusions: string[];
  strategy_limitations: string[];
  strategy_localized_terms: string[];
  strategy_sources: string[];
  strategy_terms: string[];
  target_segments: string[];
  warnings: string[];
};

type CreateCampaignInput = {
  desiredLeadCount: number;
  exclusions: string[];
  geography: string;
  industryTerms: string[];
  language: string;
  localizedTerms: string[];
  name: string;
  objective: string;
  offerId: string;
  qualificationCriteria: string[];
  sourceCategories: string[];
  targetSegments: string[];
  terms: string[];
};

const campaignSelect = `
  external_id,
  name,
  offer_external_id,
  objective,
  geography,
  target_segments,
  progress,
  lead_count,
  awaiting_review,
  status,
  last_activity_label,
  language,
  warnings,
  strategy_terms,
  strategy_localized_terms,
  strategy_sources,
  strategy_criteria,
  strategy_exclusions,
  strategy_limitations
`;

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load campaigns: ${error.message}`);
  }

  return ((data ?? []) as CampaignRow[]).map(mapCampaign);
}

export async function getCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<Campaign | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load campaign: ${error.message}`);
  }

  return data ? mapCampaign(data as CampaignRow) : null;
}

export async function updateCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: CampaignStatus,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      last_activity_label: "Just now",
      status,
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId)
    .select(campaignSelect)
    .single();

  if (error) {
    throw new Error(`Could not update campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
}

export async function createCampaign(
  workspaceId: string,
  input: CreateCampaignInput,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const externalId = await createUniqueCampaignExternalId(workspaceId, input.name);
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      awaiting_review: 0,
      external_id: externalId,
      geography: input.geography,
      language: input.language,
      last_activity_label: "Just now",
      lead_count: input.desiredLeadCount,
      name: input.name,
      objective: input.objective,
      offer_external_id: input.offerId,
      progress: 0,
      status: "planning",
      strategy_criteria: input.qualificationCriteria,
      strategy_exclusions: input.exclusions,
      strategy_limitations: [
        "New campaign has not run discovery yet.",
        "Lead counts are targets until discovery creates records.",
      ],
      strategy_localized_terms: input.localizedTerms,
      strategy_sources: input.sourceCategories,
      strategy_terms: [...input.terms, ...input.industryTerms],
      target_segments: input.targetSegments,
      warnings: ["Review strategy before starting discovery."],
      workspace_id: workspaceId,
    })
    .select(campaignSelect)
    .single();

  if (error) {
    throw new Error(`Could not create campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
}

export async function importSampleCampaigns(workspaceId: string): Promise<number> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .upsert(
      sampleCampaigns.map((campaign) => ({
        awaiting_review: campaign.awaitingReview,
        external_id: campaign.id,
        geography: campaign.geography,
        language: campaign.language,
        last_activity_label: campaign.lastActivity,
        lead_count: campaign.leadCount,
        name: campaign.name,
        objective: campaign.objective,
        offer_external_id: campaign.offerId,
        progress: campaign.progress,
        status: campaign.status,
        strategy_criteria: campaign.strategy.criteria,
        strategy_exclusions: campaign.strategy.exclusions,
        strategy_limitations: campaign.strategy.limitations,
        strategy_localized_terms: campaign.strategy.localizedTerms,
        strategy_sources: campaign.strategy.sources,
        strategy_terms: campaign.strategy.terms,
        target_segments: campaign.targetSegments,
        warnings: campaign.warnings,
        workspace_id: workspaceId,
      })),
      { onConflict: "workspace_id,external_id" },
    )
    .select("id");

  if (error) {
    throw new Error(`Could not import sample campaigns: ${error.message}`);
  }

  return data?.length ?? 0;
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    awaitingReview: row.awaiting_review,
    geography: row.geography,
    id: row.external_id,
    language: row.language,
    lastActivity: row.last_activity_label,
    leadCount: row.lead_count,
    name: row.name,
    objective: row.objective,
    offerId: row.offer_external_id,
    progress: row.progress,
    status: row.status,
    strategy: {
      criteria: row.strategy_criteria,
      exclusions: row.strategy_exclusions,
      limitations: row.strategy_limitations,
      localizedTerms: row.strategy_localized_terms,
      sources: row.strategy_sources,
      terms: row.strategy_terms,
    },
    targetSegments: row.target_segments,
    warnings: row.warnings,
  };
}

async function createUniqueCampaignExternalId(workspaceId: string, name: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const baseSlug = slugify(name) || "campaign";
  let candidate = baseSlug;
  let suffix = 0;

  while (true) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("external_id", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not check campaign slug: ${error.message}`);
    }

    if (!data) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
