import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { CampaignStrategyVersion } from "@/types/domain";

type StrategyRow = {
  id: string;
  version: number;
  status: CampaignStrategyVersion["status"];
  target_geography: string;
  company_types: string[];
  industries: string[];
  characteristics: string[];
  relevance_reasons: string[];
  opportunity_assumptions: string[];
  qualification_criteria: string[];
  positive_signals: string[];
  exclusions: string[];
  contact_roles: string[];
  contact_departments: string[];
  acceptable_contact_routes: string[];
  search_languages: string[];
  source_categories: string[];
  search_terms: string[];
  localized_terms: string[];
  limitations: string[];
  target_company_count: number;
  refinement_summary: string[];
};

const strategySelect = `id, version, status, target_geography, company_types, industries, characteristics, relevance_reasons, opportunity_assumptions, qualification_criteria, positive_signals, exclusions, contact_roles, contact_departments, acceptable_contact_routes, search_languages, source_categories, search_terms, localized_terms, limitations, target_company_count, refinement_summary`;

export async function getCurrentCampaignStrategy(
  workspaceId: string,
  campaignExternalId: string,
): Promise<CampaignStrategyVersion | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("current_strategy_version_id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .maybeSingle();
  if (campaignError)
    throw new Error(
      `Could not load campaign strategy reference: ${campaignError.message}`,
    );
  const versionId = (campaign as { current_strategy_version_id: string | null } | null)
    ?.current_strategy_version_id;
  if (!versionId) return null;
  const { data, error } = await supabase
    .from("campaign_strategy_versions")
    .select(strategySelect)
    .eq("workspace_id", workspaceId)
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Campaign Strategy: ${error.message}`);
  return data ? mapStrategy(data as StrategyRow) : null;
}

export async function saveCampaignStrategyVersion(
  workspaceId: string,
  campaignExternalId: string,
  strategy: CampaignStrategyVersion,
): Promise<CampaignStrategyVersion> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase.rpc("save_campaign_strategy_version", {
    target_workspace_id: workspaceId,
    target_campaign_external_id: campaignExternalId,
    strategy_data: strategy,
  });
  if (error) throw new Error(`Could not save Campaign Strategy: ${error.message}`);
  return mapStrategy(data as StrategyRow);
}

function mapStrategy(row: StrategyRow): CampaignStrategyVersion {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    targetGeography: row.target_geography,
    companyTypes: row.company_types,
    industries: row.industries,
    characteristics: row.characteristics,
    relevanceReasons: row.relevance_reasons,
    opportunityAssumptions: row.opportunity_assumptions,
    qualificationCriteria: row.qualification_criteria,
    positiveSignals: row.positive_signals,
    exclusions: row.exclusions,
    contactRoles: row.contact_roles,
    contactDepartments: row.contact_departments,
    acceptableContactRoutes: row.acceptable_contact_routes,
    searchLanguages: row.search_languages,
    sourceCategories: row.source_categories,
    searchTerms: row.search_terms,
    localizedTerms: row.localized_terms,
    limitations: row.limitations,
    targetCompanyCount: row.target_company_count,
    refinementSummary: row.refinement_summary,
  };
}
