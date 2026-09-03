import {
  discoveryProviderCapabilitiesSchema,
  type DiscoveryProviderCapabilities,
} from "../../discovery-v2/contracts.ts";
import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import { assertMarketAnalysisReadyForResearchPlan } from "./market-analysis-compiler.ts";
import {
  marketResearchPlanSchema,
  type DiscoveryRoute,
  type MarketAnalysis,
  type MarketResearchPlan,
} from "./market-intelligence.ts";

export const MARKET_RESEARCH_PLAN_SCHEMA_VERSION = "market-research-plan/v1";
export const MARKET_RESEARCH_PLAN_COMPILER_VERSION =
  "confirmed-market-provider-route-compiler/v1";

export type FrozenProviderCapability = {
  snapshotId: string;
  capabilities: DiscoveryProviderCapabilities;
};

export function compileMarketResearchPlan(input: {
  artifactId: string;
  analysis: MarketAnalysis;
  target: CampaignTargetModel;
  userConfirmed: boolean;
  providerCapabilities: FrozenProviderCapability[];
  createdAt: string;
}): MarketResearchPlan {
  assertInputs(input);
  const capabilities = input.providerCapabilities
    .map((entry) => ({
      snapshotId: entry.snapshotId,
      capabilities: discoveryProviderCapabilitiesSchema.parse(entry.capabilities),
    }))
    .sort((a, b) => compareText(a.snapshotId, b.snapshotId));
  const routes = buildRoutes(input.analysis, capabilities);
  if (!routes.length) {
    throw new Error("No frozen provider capability can execute the Market Analysis.");
  }
  routes[0]!.role = "primary";
  const verificationRoutes = buildVerificationRoutes(input.analysis, capabilities);
  const body = {
    workspaceId: input.analysis.workspaceId,
    campaignId: input.analysis.campaignId,
    marketAnalysisVersionId: input.analysis.id,
    campaignTargetModelVersionId: input.target.id,
    providerCapabilitySnapshotIds: capabilities.map(({ snapshotId }) => snapshotId),
    discoveryRoutes: routes,
    verificationRoutes,
    expectedCoverageRisks: input.analysis.coverageRisks,
    redirectCriteria: [
      "Redirect when a primary route produces no new Organization References in a completed pass.",
      "Redirect when observed source coverage materially excludes a priority archetype.",
    ],
    stopSignals: [
      "Stop when every primary route is exhausted or unable to add unique Organization References.",
      "Stop when all remaining coverage gaps require an unavailable provider capability.",
    ],
  };
  return marketResearchPlanSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: MARKET_RESEARCH_PLAN_SCHEMA_VERSION,
      compilerVersion: MARKET_RESEARCH_PLAN_COMPILER_VERSION,
      inputHash: hashCanonical({
        analysisContentHash: input.analysis.version.contentHash,
        targetContentHash: input.target.version.contentHash,
        providerCapabilities: capabilities,
        compilerVersion: MARKET_RESEARCH_PLAN_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

function assertInputs(input: Parameters<typeof compileMarketResearchPlan>[0]) {
  assertMarketAnalysisReadyForResearchPlan({
    analysis: input.analysis,
    userConfirmed: input.userConfirmed,
  });
  if (input.analysis.workspaceId !== input.target.workspaceId) {
    throw new Error("Market Analysis and Target Model belong to different workspaces.");
  }
  if (input.analysis.campaignId !== input.target.campaignId) {
    throw new Error("Market Analysis and Target Model belong to different Campaigns.");
  }
  if (input.analysis.campaignTargetModelVersionId !== input.target.id) {
    throw new Error("Market Analysis does not reference the supplied Target Model.");
  }
  const snapshotIds = input.providerCapabilities.map(({ snapshotId }) => snapshotId);
  if (!snapshotIds.length || new Set(snapshotIds).size !== snapshotIds.length) {
    throw new Error("Research planning requires unique frozen provider capabilities.");
  }
}

function buildRoutes(analysis: MarketAnalysis, capabilities: FrozenProviderCapability[]) {
  const routes: DiscoveryRoute[] = [];
  for (const archetype of analysis.targetArchetypes) {
    for (const sourceFamily of analysis.majorSourceFamilies) {
      const sourceTypes = providerSourceTypes(sourceFamily);
      const compatible = compatibleCapabilities(analysis, capabilities, sourceTypes);
      if (!compatible.length) continue;
      routes.push({
        id: `route.${archetype.archetypeId}.${sourceFamily}`,
        archetypeIds: [archetype.archetypeId],
        providerCapabilitySnapshotIds: compatible.map(({ snapshotId }) => snapshotId),
        sourceFamily,
        providerSourceTypes: uniqueSorted(
          compatible.flatMap(({ capabilities: item }) =>
            item.sourceTypes.filter((sourceType) => sourceTypes.includes(sourceType)),
          ),
        ),
        role: archetype.priority === "priority" ? "primary" : "supporting",
        priority: routePriority(archetype.priority, routes.length),
        rationale: boundedText(
          `${sourceFamily.replaceAll("_", " ")} coverage for ${archetype.rationale}`,
          800,
        ),
        languages: routeLanguages(analysis, compatible),
        vocabulary: uniqueSorted(
          analysis.localTerminology
            .filter(
              ({ archetypeIds }) =>
                !archetypeIds.length || archetypeIds.includes(archetype.archetypeId),
            )
            .map(({ term }) => term),
        ),
        sourceHints: analysis.importantMarketSources
          .filter((source) => source.sourceFamily === sourceFamily)
          .map(({ url, name }) => url ?? name),
        expansionMode: sourceFamily === "web_search" ? "resumable" : "bounded",
        expectedCoverage: expectedCoverage(archetype.priority, compatible.length),
      });
    }
  }
  return routes.sort((a, b) => a.priority - b.priority || compareText(a.id, b.id));
}

function buildVerificationRoutes(
  analysis: MarketAnalysis,
  capabilities: FrozenProviderCapability[],
) {
  const compatible = compatibleCapabilities(analysis, capabilities, ["web_search"]);
  if (!compatible.length) return [];
  return [
    {
      id: "route.verification.official-website",
      archetypeIds: analysis.targetArchetypes.map(({ archetypeId }) => archetypeId),
      providerCapabilitySnapshotIds: compatible.map(({ snapshotId }) => snapshotId),
      sourceFamily: "official_website" as const,
      providerSourceTypes: ["web_search" as const],
      role: "verification" as const,
      priority: 1000,
      rationale:
        "Verify organization identity and official-web presence separately from discovery.",
      languages: routeLanguages(analysis, compatible),
      vocabulary: [],
      sourceHints: [],
      expansionMode: "bounded" as const,
      expectedCoverage: "unknown" as const,
    },
  ];
}

function compatibleCapabilities(
  analysis: MarketAnalysis,
  entries: FrozenProviderCapability[],
  sourceTypes: ReturnType<typeof providerSourceTypes>,
) {
  return entries.filter(({ capabilities }) => {
    if (
      !capabilities.sourceTypes.some((sourceType) => sourceTypes.includes(sourceType))
    ) {
      return false;
    }
    if (
      capabilities.supportedCountries?.length &&
      !analysis.geography.countryCodes.includes("WORLDWIDE") &&
      !analysis.geography.countryCodes.some((country) =>
        capabilities.supportedCountries!.includes(country),
      )
    ) {
      return false;
    }
    return true;
  });
}

function providerSourceTypes(
  sourceFamily: MarketAnalysis["majorSourceFamilies"][number],
) {
  const mapping = {
    local_business: ["maps"],
    official_website: ["web_search"],
    company_database: ["company_database"],
    registry: ["registry"],
    industry_directory: ["industry_directory", "web_search"],
    association: ["industry_directory", "web_search"],
    certification_list: ["industry_directory", "web_search"],
    trade_event: ["web_search"],
    marketplace: ["marketplace", "web_search"],
    partner_ecosystem: ["industry_directory", "web_search"],
    funding_database: ["funding"],
    jobs: ["jobs"],
    news: ["news"],
    web_search: ["web_search"],
    other: ["web_search"],
  } as const;
  return [...mapping[sourceFamily]];
}

function routeLanguages(analysis: MarketAnalysis, entries: FrozenProviderCapability[]) {
  const desired = uniqueSorted([
    ...analysis.localLanguages,
    ...analysis.geography.workingLanguages,
  ]);
  const supported = new Set(
    entries.flatMap(({ capabilities }) => capabilities.supportedLanguages ?? desired),
  );
  const usable = desired.filter((language) => supported.has(language));
  return usable.length ? usable : analysis.geography.workingLanguages;
}

function routePriority(
  priority: "priority" | "secondary" | "exploratory",
  index: number,
) {
  const base = priority === "priority" ? 0 : priority === "secondary" ? 100 : 200;
  return base + index + 1;
}

function expectedCoverage(
  priority: "priority" | "secondary" | "exploratory",
  providerCount: number,
) {
  if (priority === "exploratory") return "low" as const;
  return providerCount > 1 ? ("high" as const) : ("medium" as const);
}

function boundedText(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
