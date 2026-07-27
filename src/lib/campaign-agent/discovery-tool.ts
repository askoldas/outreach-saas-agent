import { CAMPAIGN_EXECUTION_LIMITS } from "./execution-policy.ts";
import type { CampaignAgentObservation, CampaignAgentPlan } from "./loop.ts";
import type { CampaignAgentTool } from "./tool-registry.ts";

export const campaignDiscoveryToolName = "discover_companies";

export function createCampaignDiscoveryTool(
  execute: (
    input: CampaignAgentPlan,
    context: { campaignRunId: string; iteration: number; workspaceId: string },
  ) => Promise<CampaignAgentObservation>,
): CampaignAgentTool<CampaignAgentPlan, CampaignAgentObservation> {
  return {
    name: campaignDiscoveryToolName,
    version: "v1",
    description:
      "Search approved public sources for prospect companies using a bounded query plan.",
    execute,
    parseInput: parsePlan,
    parseOutput: parseObservation,
  };
}

function parsePlan(value: unknown): CampaignAgentPlan {
  const row = record(value);
  if (
    !Array.isArray(row.queries) ||
    row.queries.length === 0 ||
    row.queries.length > CAMPAIGN_EXECUTION_LIMITS.maxQueriesPerIteration ||
    row.queries.some((query) => typeof query !== "string" || !query.trim())
  )
    throw new Error("Campaign discovery tool received invalid queries.");
  const resultsPerQuery = Number(row.resultsPerQuery);
  if (
    !Number.isInteger(resultsPerQuery) ||
    resultsPerQuery < 1 ||
    resultsPerQuery > CAMPAIGN_EXECUTION_LIMITS.maxResultsPerQuery
  )
    throw new Error("Campaign discovery tool received invalid result bounds.");
  if (typeof row.rationale !== "string" || !row.rationale.trim())
    throw new Error("Campaign discovery tool received an invalid rationale.");
  return {
    queries: row.queries.map((query) => (query as string).trim()),
    rationale: row.rationale.trim(),
    resultsPerQuery,
  };
}

function parseObservation(value: unknown): CampaignAgentObservation {
  const row = record(value);
  for (const key of ["acceptedCompanies", "inspectedCompanies", "rejectedCompanies"])
    if (!Number.isInteger(row[key]) || Number(row[key]) < 0)
      throw new Error(`Campaign discovery tool returned invalid ${key}.`);
  return {
    acceptedCompanies: Number(row.acceptedCompanies),
    inspectedCompanies: Number(row.inspectedCompanies),
    rejectedCompanies: Number(row.rejectedCompanies),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Campaign Agent tool payload must be an object.");
  return value as Record<string, unknown>;
}
