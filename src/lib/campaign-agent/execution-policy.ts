export const CAMPAIGN_EXECUTION_LIMITS = {
  maxCompaniesInspected: 500,
  maxDiscoveryIterations: 5,
  maxQueriesPerIteration: 10,
  maxResultsPerQuery: 50,
} as const;

const defaultResultsPerQuery = 8;

export function createDiscoveryBounds(desiredCompanyCount: number) {
  return {
    companies:
      positiveInteger(desiredCompanyCount) >
      CAMPAIGN_EXECUTION_LIMITS.maxCompaniesInspected
        ? CAMPAIGN_EXECUTION_LIMITS.maxCompaniesInspected
        : positiveInteger(desiredCompanyCount),
    queries: CAMPAIGN_EXECUTION_LIMITS.maxQueriesPerIteration,
    resultsPerQuery: Math.min(
      defaultResultsPerQuery,
      CAMPAIGN_EXECUTION_LIMITS.maxResultsPerQuery,
    ),
  };
}

function positiveInteger(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 1;
}
