import { generateTextResult } from "../providers/openrouter.ts";
import { parseCompleteJsonObject } from "../ai/structured-json.ts";

export const marketAnalysisPromptVersion = "campaign-market-analysis-v3";
export const discoveryPlanPromptVersion = "campaign-discovery-plan-v3";

export type MarketAnalysis = {
  summary: string;
  marketBreadth: "very_narrow" | "narrow" | "medium" | "broad" | "very_broad";
  estimatedCandidateRange?: { min?: number; max?: number };
  relevantCompanyCategories: string[];
  adjacentCategories: string[];
  localTerminology: string[];
  likelySourceTypes: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  exclusions: string[];
  likelyDataChallenges: string[];
  recommendedDiscoveryApproach: string;
  confidence: number;
};

export type DiscoveryPath = {
  id: string;
  type:
    | "direct_search"
    | "local_language_search"
    | "industry_terminology"
    | "directory"
    | "association"
    | "event_exhibitors"
    | "partner_directory"
    | "adjacent_category";
  rationale: string;
  expectedCompanyCategory: string;
  priority: number;
  queries: string[];
  sourceHints?: string[];
  expectedYield?: "low" | "medium" | "high";
  maxResults: number;
};

export type DiscoveryPlan = {
  strategySummary: string;
  paths: DiscoveryPath[];
  stopConditions: {
    targetQualifiedCompanies: number;
    maxIterations: number;
    maxQueriesPerIteration: number;
    maxResultsPerQuery: number;
    minimumMarginalQualifiedYield: number;
  };
};

export async function generateMarketAnalysisAndPlan(input: {
  campaign: Record<string, unknown>;
  confirmedBrief: Record<string, unknown>;
  profileSnapshot: Record<string, unknown>;
  targetQualifiedCompanies: number;
}) {
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content:
          "Produce a compact operational market analysis and an auditable bounded B2B company discovery plan. Use local terminology and multiple distinct paths. Queries must find target companies, never the seller. Return one JSON object only, with no markdown or commentary. Keep every string concise. Use at most 8 items in each market-analysis list, 3-6 discovery paths, 2-5 queries per path, and at most 5 source hints per path. Every discovery path type must be exactly one of: direct_search, local_language_search, industry_terminology, directory, association, event_exhibitors, partner_directory, adjacent_category. Maximum 5 iterations, 10 queries per iteration, 50 results per query. Do not provide hidden reasoning.",
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersions: {
            marketAnalysis: marketAnalysisPromptVersion,
            discoveryPlan: discoveryPlanPromptVersion,
          },
          ...input,
          requiredShape: {
            marketAnalysis: {
              summary: "",
              marketBreadth: "medium",
              estimatedCandidateRange: { min: 1, max: 1000 },
              relevantCompanyCategories: [],
              adjacentCategories: [],
              localTerminology: [],
              likelySourceTypes: [],
              positiveSignals: [],
              negativeSignals: [],
              exclusions: [],
              likelyDataChallenges: [],
              recommendedDiscoveryApproach: "",
              confidence: 0.8,
            },
            discoveryPlan: {
              strategySummary: "",
              paths: [
                {
                  id: "direct-1",
                  type: "direct_search",
                  rationale: "",
                  expectedCompanyCategory: "",
                  priority: 1,
                  queries: [],
                  sourceHints: [],
                  expectedYield: "medium",
                  maxResults: 25,
                },
              ],
              stopConditions: {
                targetQualifiedCompanies: input.targetQualifiedCompanies,
                maxIterations: 5,
                maxQueriesPerIteration: 10,
                maxResultsPerQuery: 50,
                minimumMarginalQualifiedYield: 0.02,
              },
            },
          },
        }),
      },
    ],
    {
      role: "campaign_planning",
      taskName: "campaign market analysis and discovery planning",
      jsonMode: true,
      maxCompletionTokens: 6000,
      reasoningEffort: "none",
    },
  );
  const raw = parseCompleteJsonObject(modelCall.data);
  if (raw === undefined) {
    throw new Error("Market planning returned invalid JSON.");
  }
  const row = record(raw, "market planning");
  return {
    marketAnalysis: parseMarketAnalysis(row.marketAnalysis),
    discoveryPlan: parseDiscoveryPlan(row.discoveryPlan, input.targetQualifiedCompanies),
    modelCall,
  };
}

export function parseMarketAnalysis(value: unknown): MarketAnalysis {
  const row = record(value, "marketAnalysis");
  const breadth = text(row.marketBreadth, "marketBreadth");
  if (!["very_narrow", "narrow", "medium", "broad", "very_broad"].includes(breadth)) {
    throw new Error("Market analysis returned invalid marketBreadth.");
  }
  const range =
    row.estimatedCandidateRange === undefined
      ? undefined
      : record(row.estimatedCandidateRange, "estimatedCandidateRange");
  return {
    summary: text(row.summary, "summary"),
    marketBreadth: breadth as MarketAnalysis["marketBreadth"],
    ...(range
      ? {
          estimatedCandidateRange: {
            ...(range.min === undefined
              ? {}
              : { min: bounded(range.min, 0, 10_000_000) }),
            ...(range.max === undefined
              ? {}
              : { max: bounded(range.max, 0, 10_000_000) }),
          },
        }
      : {}),
    relevantCompanyCategories: list(
      row.relevantCompanyCategories,
      "relevantCompanyCategories",
    ),
    adjacentCategories: list(row.adjacentCategories, "adjacentCategories"),
    localTerminology: list(row.localTerminology, "localTerminology"),
    likelySourceTypes: list(row.likelySourceTypes, "likelySourceTypes"),
    positiveSignals: list(row.positiveSignals, "positiveSignals"),
    negativeSignals: list(row.negativeSignals, "negativeSignals"),
    exclusions: list(row.exclusions, "exclusions"),
    likelyDataChallenges: list(row.likelyDataChallenges, "likelyDataChallenges"),
    recommendedDiscoveryApproach: text(
      row.recommendedDiscoveryApproach,
      "recommendedDiscoveryApproach",
    ),
    confidence: bounded(row.confidence, 0, 1),
  };
}

export function parseDiscoveryPlan(
  value: unknown,
  targetQualifiedCompanies: number,
): DiscoveryPlan {
  const row = record(value, "discoveryPlan");
  if (!Array.isArray(row.paths) || row.paths.length < 2) {
    throw new Error("Discovery plan must contain at least two auditable paths.");
  }
  const paths = row.paths.slice(0, 12).map((value, index): DiscoveryPath => {
    const path = record(value, `paths.${index}`);
    const type = normalizePathType(text(path.type, "path.type"));
    const expectedYield = path.expectedYield;
    return {
      id: text(path.id, "path.id").replace(/[^a-zA-Z0-9_-]/g, "-"),
      type,
      rationale: text(path.rationale, "path.rationale"),
      expectedCompanyCategory: text(
        path.expectedCompanyCategory,
        "path.expectedCompanyCategory",
      ),
      priority: Math.max(1, Math.floor(bounded(path.priority, 1, 100))),
      queries: list(path.queries, "path.queries").slice(0, 10),
      ...(path.sourceHints === undefined
        ? {}
        : { sourceHints: list(path.sourceHints, "path.sourceHints") }),
      ...(expectedYield === "low" ||
      expectedYield === "medium" ||
      expectedYield === "high"
        ? { expectedYield }
        : {}),
      maxResults: Math.floor(bounded(path.maxResults, 1, 50)),
    };
  });
  const stop = record(row.stopConditions, "stopConditions");
  return {
    strategySummary: text(row.strategySummary, "strategySummary"),
    paths,
    stopConditions: {
      targetQualifiedCompanies,
      maxIterations: Math.floor(bounded(stop.maxIterations, 1, 5)),
      maxQueriesPerIteration: Math.floor(bounded(stop.maxQueriesPerIteration, 1, 10)),
      maxResultsPerQuery: Math.floor(bounded(stop.maxResultsPerQuery, 1, 50)),
      minimumMarginalQualifiedYield: bounded(stop.minimumMarginalQualifiedYield, 0, 1),
    },
  };
}

function normalizePathType(value: string): DiscoveryPath["type"] {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const exact = new Set<DiscoveryPath["type"]>([
    "direct_search",
    "local_language_search",
    "industry_terminology",
    "directory",
    "association",
    "event_exhibitors",
    "partner_directory",
    "adjacent_category",
  ]);
  if (exact.has(normalized as DiscoveryPath["type"])) {
    return normalized as DiscoveryPath["type"];
  }
  if (/local|language|localized/.test(normalized)) return "local_language_search";
  if (/terminology|keyword|industry/.test(normalized)) return "industry_terminology";
  if (/exhibitor|event|trade_show|conference/.test(normalized)) return "event_exhibitors";
  if (/association|chamber|trade_body/.test(normalized)) return "association";
  if (/partner|vendor|marketplace/.test(normalized)) return "partner_directory";
  if (/directory|catalog|registry|database/.test(normalized)) return "directory";
  if (/adjacent|alternative|related/.test(normalized)) return "adjacent_category";
  return "direct_search";
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Market planning returned invalid ${field}.`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2) {
    throw new Error(`Market planning returned invalid ${field}.`);
  }
  return value.trim();
}
function list(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Market planning returned invalid ${field}.`);
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}
function bounded(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error("Market planning returned a number outside its allowed range.");
  }
  return parsed;
}
