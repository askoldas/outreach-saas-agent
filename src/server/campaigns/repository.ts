import { campaigns as sampleCampaigns } from "@/data/mock/prospecting";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Campaign, CampaignStatus, DiscoveryReport } from "@/types/domain";

type CampaignRow = {
  awaiting_review: number;
  desired_lead_count?: number;
  external_id: string;
  geography: string;
  industry_terms?: string[];
  language: string;
  last_activity_label: string;
  latest_discovery_report?: DiscoveryReport | null;
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

type UpdateCampaignInput = CreateCampaignInput & {
  campaignId: string;
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

const campaignSelectWithIndustryTerms = `
  ${campaignSelect},
  desired_lead_count,
  industry_terms,
  latest_discovery_report
`;

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelectWithIndustryTerms)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (isMissingIndustryTermsColumnError(error)) {
    return listCampaignsWithoutIndustryTerms(workspaceId);
  }

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
    .select(campaignSelectWithIndustryTerms)
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId)
    .maybeSingle();

  if (isMissingIndustryTermsColumnError(error)) {
    return getCampaignWithoutIndustryTerms(workspaceId, campaignId);
  }

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
    .select(campaignSelectWithIndustryTerms)
    .single();

  if (isMissingIndustryTermsColumnError(error)) {
    return updateCampaignStatusWithoutIndustryTerms(workspaceId, campaignId, status);
  }

  if (error) {
    throw new Error(`Could not update campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
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
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      awaiting_review: input.awaitingReview,
      last_activity_label: "Just now",
      latest_discovery_report: input.latestDiscoveryReport,
      lead_count: input.leadCount,
      progress: input.progress,
      status: input.status,
      warnings:
        input.latestDiscoveryReport.aiQualificationFailures.length > 0
          ? [
              `${input.latestDiscoveryReport.aiQualificationFailures.length} lead qualification result${input.latestDiscoveryReport.aiQualificationFailures.length === 1 ? "" : "s"} need manual review.`,
            ]
          : [],
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId);

  if (isMissingCampaignWorkflowColumnError(error)) {
    const fallback = await supabase
      .from("campaigns")
      .update({
        awaiting_review: input.awaitingReview,
        last_activity_label: "Just now",
        lead_count: input.leadCount,
        progress: input.progress,
        status: input.status,
        warnings:
          input.latestDiscoveryReport.aiQualificationFailures.length > 0
            ? [
                `${input.latestDiscoveryReport.aiQualificationFailures.length} lead qualification result${input.latestDiscoveryReport.aiQualificationFailures.length === 1 ? "" : "s"} need manual review.`,
              ]
            : [],
      })
      .eq("workspace_id", workspaceId)
      .eq("external_id", campaignId);

    if (fallback.error) {
      throw new Error(`Could not update discovery state: ${fallback.error.message}`);
    }

    return;
  }

  if (error) {
    throw new Error(`Could not update discovery state: ${error.message}`);
  }
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
      desired_lead_count: input.desiredLeadCount,
      external_id: externalId,
      geography: input.geography,
      industry_terms: input.industryTerms,
      language: input.language,
      last_activity_label: "Just now",
      lead_count: 0,
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
      strategy_terms: input.terms,
      target_segments: input.targetSegments,
      warnings: ["Review strategy before starting discovery."],
      workspace_id: workspaceId,
    })
    .select(campaignSelectWithIndustryTerms)
    .single();

  if (isMissingIndustryTermsColumnError(error)) {
    return createCampaignWithoutIndustryTerms(workspaceId, externalId, input);
  }

  if (error) {
    throw new Error(`Could not create campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
}

export async function updateCampaign(
  workspaceId: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      desired_lead_count: input.desiredLeadCount,
      geography: input.geography,
      industry_terms: input.industryTerms,
      language: input.language,
      last_activity_label: "Just now",
      name: input.name,
      objective: input.objective,
      offer_external_id: input.offerId,
      strategy_criteria: input.qualificationCriteria,
      strategy_exclusions: input.exclusions,
      strategy_limitations: ["Campaign strategy was manually edited."],
      strategy_localized_terms: input.localizedTerms,
      strategy_sources: input.sourceCategories,
      strategy_terms: input.terms,
      target_segments: input.targetSegments,
      warnings: ["Review edited strategy before starting discovery."],
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", input.campaignId)
    .select(campaignSelectWithIndustryTerms)
    .single();

  if (isMissingIndustryTermsColumnError(error)) {
    return updateCampaignWithoutIndustryTerms(workspaceId, input);
  }

  if (error) {
    throw new Error(`Could not update campaign: ${error.message}`);
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
        desired_lead_count: campaign.desiredLeadCount,
        external_id: campaign.id,
        geography: campaign.geography,
        industry_terms: campaign.industryTerms,
        language: campaign.language,
        last_activity_label: campaign.lastActivity,
        latest_discovery_report: campaign.latestDiscoveryReport,
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

  if (isMissingIndustryTermsColumnError(error)) {
    return importSampleCampaignsWithoutIndustryTerms(workspaceId);
  }

  if (error) {
    throw new Error(`Could not import sample campaigns: ${error.message}`);
  }

  return data?.length ?? 0;
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    awaitingReview: row.awaiting_review,
    desiredLeadCount: row.desired_lead_count ?? (row.lead_count || 25),
    geography: row.geography,
    industryTerms: row.industry_terms ?? [],
    id: row.external_id,
    language: row.language,
    lastActivity: row.last_activity_label,
    latestDiscoveryReport: row.latest_discovery_report ?? null,
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

async function listCampaignsWithoutIndustryTerms(
  workspaceId: string,
): Promise<Campaign[]> {
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

async function getCampaignWithoutIndustryTerms(
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

async function updateCampaignStatusWithoutIndustryTerms(
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

async function createCampaignWithoutIndustryTerms(
  workspaceId: string,
  externalId: string,
  input: CreateCampaignInput,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
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
        "Industry terms require the campaign industry terms migration.",
      ],
      strategy_localized_terms: input.localizedTerms,
      strategy_sources: input.sourceCategories,
      strategy_terms: input.terms,
      target_segments: input.targetSegments,
      warnings: ["Apply the campaign industry terms migration to persist industries."],
      workspace_id: workspaceId,
    })
    .select(campaignSelect)
    .single();

  if (error) {
    throw new Error(`Could not create campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
}

async function updateCampaignWithoutIndustryTerms(
  workspaceId: string,
  input: UpdateCampaignInput,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({
      geography: input.geography,
      language: input.language,
      last_activity_label: "Just now",
      lead_count: input.desiredLeadCount,
      name: input.name,
      objective: input.objective,
      offer_external_id: input.offerId,
      strategy_criteria: input.qualificationCriteria,
      strategy_exclusions: input.exclusions,
      strategy_limitations: [
        "Campaign strategy was manually edited.",
        "Industry terms require the campaign industry terms migration.",
      ],
      strategy_localized_terms: input.localizedTerms,
      strategy_sources: input.sourceCategories,
      strategy_terms: input.terms,
      target_segments: input.targetSegments,
      warnings: ["Apply the campaign industry terms migration to persist industries."],
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", input.campaignId)
    .select(campaignSelect)
    .single();

  if (error) {
    throw new Error(`Could not update campaign: ${error.message}`);
  }

  return mapCampaign(data as CampaignRow);
}

async function importSampleCampaignsWithoutIndustryTerms(
  workspaceId: string,
): Promise<number> {
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

function isMissingIndustryTermsColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return (
    (message.includes("industry_terms") ||
      message.includes("desired_lead_count") ||
      message.includes("latest_discovery_report")) &&
    (message.includes("does not exist") ||
      message.includes("Could not find") ||
      message.includes("schema cache"))
  );
}

function isMissingCampaignWorkflowColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  const mentionsWorkflowColumn =
    message.includes("desired_lead_count") ||
    message.includes("latest_discovery_report");
  const isMissingColumn =
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    message.includes("schema cache");

  return mentionsWorkflowColumn && isMissingColumn;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
