import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { saveCampaignStrategyVersion } from "@/server/campaign-strategy/repository";
import type {
  Campaign,
  CampaignStatus,
  CampaignStrategyVersion,
  DiscoveryReport,
} from "@/types/domain";

type CampaignRow = {
  awaiting_review: number;
  current_strategy_version_id: string;
  desired_lead_count: number;
  external_id: string;
  geography: string;
  industry_terms: string[];
  language: string;
  last_activity_label: string;
  latest_discovery_report: DiscoveryReport | null;
  lead_count: number;
  name: string;
  objective: string;
  progress: number;
  status: CampaignStatus;
  target_segments: string[];
  warnings: string[];
};

type StrategyRow = {
  id: string;
  exclusions: string[];
  limitations: string[];
  localized_terms: string[];
  qualification_criteria: string[];
  search_terms: string[];
  source_categories: string[];
};

export type CreateCampaignInput = {
  desiredLeadCount: number;
  exclusions: string[];
  geography: string;
  industryTerms: string[];
  language: string;
  localizedTerms: string[];
  name: string;
  objective: string;
  qualificationCriteria: string[];
  sourceCategories: string[];
  targetSegments: string[];
  terms: string[];
};

const campaignSelect = `external_id,name,objective,geography,target_segments,progress,lead_count,awaiting_review,status,last_activity_label,language,warnings,desired_lead_count,industry_terms,latest_discovery_report,current_strategy_version_id`;
const strategySelect = `id,search_terms,localized_terms,source_categories,qualification_criteria,exclusions,limitations`;

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignSelect)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  if (error) throw new Error(`Could not load campaigns: ${error.message}`);
  return hydrateCampaigns(supabase, workspaceId, (data ?? []) as CampaignRow[]);
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
  if (error) throw new Error(`Could not load campaign: ${error.message}`);
  if (!data) return null;
  const [campaign] = await hydrateCampaigns(supabase, workspaceId, [data as CampaignRow]);
  return campaign ?? null;
}

export async function updateCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: CampaignStatus,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ last_activity_label: "Just now", status })
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId);
  if (error) throw new Error(`Could not update campaign: ${error.message}`);
  const campaign = await getCampaign(workspaceId, campaignId);
  if (!campaign) throw new Error("Updated campaign could not be reloaded.");
  return campaign;
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
  const failures = input.latestDiscoveryReport.aiQualificationFailures.length;
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
        failures > 0
          ? [
              `${failures} lead qualification result${failures === 1 ? "" : "s"} need manual review.`,
            ]
          : [],
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId);
  if (error) throw new Error(`Could not update discovery state: ${error.message}`);
}

export async function createCampaign(
  workspaceId: string,
  input: CreateCampaignInput,
): Promise<Campaign> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const externalId = await createUniqueCampaignExternalId(workspaceId, input.name);
  const { error } = await supabase.from("campaigns").insert({
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
    progress: 0,
    status: "planning",
    target_segments: input.targetSegments,
    warnings: ["Review strategy before starting discovery."],
    workspace_id: workspaceId,
  });
  if (error) throw new Error(`Could not create campaign: ${error.message}`);

  await saveCampaignStrategyVersion(workspaceId, externalId, initialStrategy(input));
  const campaign = await getCampaign(workspaceId, externalId);
  if (!campaign) throw new Error("Created campaign could not be reloaded.");
  return campaign;
}

async function hydrateCampaigns(
  supabase: Awaited<ReturnType<typeof createAuthenticatedDatabaseClient>>["supabase"],
  workspaceId: string,
  rows: CampaignRow[],
) {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((row) => row.current_strategy_version_id))];
  if (ids.some((id) => !id))
    throw new Error("Campaign is missing its current Strategy version.");
  const { data, error } = await supabase
    .from("campaign_strategy_versions")
    .select(strategySelect)
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(`Could not load campaign strategies: ${error.message}`);
  const strategies = new Map(
    ((data ?? []) as StrategyRow[]).map((strategy) => [strategy.id, strategy]),
  );
  return rows.map((row) => {
    const strategy = strategies.get(row.current_strategy_version_id);
    if (!strategy)
      throw new Error(`Campaign ${row.external_id} has no readable Strategy version.`);
    return mapCampaign(row, strategy);
  });
}

function mapCampaign(row: CampaignRow, strategy: StrategyRow): Campaign {
  return {
    awaitingReview: row.awaiting_review,
    desiredLeadCount: row.desired_lead_count,
    geography: row.geography,
    industryTerms: row.industry_terms,
    id: row.external_id,
    language: row.language,
    lastActivity: row.last_activity_label,
    latestDiscoveryReport: row.latest_discovery_report,
    leadCount: row.lead_count,
    name: row.name,
    objective: row.objective,
    progress: row.progress,
    status: row.status,
    strategy: {
      criteria: strategy.qualification_criteria,
      exclusions: strategy.exclusions,
      limitations: strategy.limitations,
      localizedTerms: strategy.localized_terms,
      sources: strategy.source_categories,
      terms: strategy.search_terms,
    },
    targetSegments: row.target_segments,
    warnings: row.warnings,
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
    searchLanguages: [input.language],
    sourceCategories: input.sourceCategories,
    searchTerms: input.terms,
    localizedTerms: input.localizedTerms,
    limitations: ["New campaign has not run discovery yet."],
    targetCompanyCount: input.desiredLeadCount,
    refinementSummary: ["Initial strategy created from campaign brief."],
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
    if (error) throw new Error(`Could not check campaign slug: ${error.message}`);
    if (!data) return candidate;
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
