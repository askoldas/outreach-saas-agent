import type { CampaignAgentPlan } from "@/lib/campaign-agent/loop";

const refinementFamilies = [
  "local business directory",
  "trade association members",
  "industry event exhibitors",
  "partner directory",
] as const;

export function buildDeterministicRefinementPlan(input: {
  iteration: number;
  previousQueries: string[];
  resultsPerQuery?: number;
}): CampaignAgentPlan {
  if (!Number.isInteger(input.iteration) || input.iteration < 2 || input.iteration > 5) {
    throw new Error("Discovery refinement iteration must be between 2 and 5.");
  }
  const refinement =
    refinementFamilies[Math.min(input.iteration - 2, refinementFamilies.length - 1)];
  const queries = unique(
    input.previousQueries
      .slice(0, 10)
      .map((query) => `${query} ${refinement}`.replace(/\s+/g, " ").trim()),
  );
  if (!queries.length) throw new Error("Discovery refinement requires prior queries.");
  return {
    queries,
    rationale: `Iteration ${input.iteration} changes the source family to ${refinement} after the prior batch did not reach the qualified-company target.`,
    resultsPerQuery: Math.min(Math.max(input.resultsPerQuery ?? 8, 1), 50),
  };
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
