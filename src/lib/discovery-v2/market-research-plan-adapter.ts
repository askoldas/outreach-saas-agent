import type { CampaignStrategyV2 } from "../intelligence/campaign-strategy-v2/schemas.ts";
import type {
  FrozenProviderCapability,
  MarketResearchPlan,
} from "../intelligence/core/index.ts";
import { compileDiscoveryPlanV2, type SegmentProviderRouteV2 } from "./planning.ts";

export function compileDiscoveryPlanFromMarketResearchPlan(input: {
  id: string;
  workspaceId: string;
  strategy: CampaignStrategyV2;
  researchPlan: MarketResearchPlan;
  providerCapabilities: FrozenProviderCapability[];
  enabledProviderIds: string[];
  versionNumber: number;
  maximumProviderCalls: number;
  maximumEstimatedCostMinor?: number;
  deadlineAt?: string;
  compiledAt: string;
}) {
  assertIdentity(input);
  const enabled = new Set(input.enabledProviderIds);
  const capabilityBySnapshotId = new Map(
    input.providerCapabilities.map((item) => [item.snapshotId, item.capabilities]),
  );
  const segmentInputs = compileOpportunitySegments(input).map((segment) => {
    const researchRoutes = routesForSegment(input.researchPlan, segment);
    if (!researchRoutes.length) {
      throw new Error(`Market Research Plan has no route for Segment ${segment.id}.`);
    }
    return {
      ...segment,
      businessCharacteristics: {
        ...segment.businessCharacteristics,
        keywords: uniqueSorted([
          ...segment.businessCharacteristics.keywords,
          ...researchRoutes.flatMap(({ vocabulary, sourceHints }) => [
            ...vocabulary,
            ...sourceHints,
          ]),
        ]),
      },
    };
  });
  const routes: SegmentProviderRouteV2[] = segmentInputs.map((segment) => {
    const researchRoutes = routesForSegment(input.researchPlan, segment);
    const providerCandidates = researchRoutes.flatMap((route) =>
      route.providerCapabilitySnapshotIds.flatMap((snapshotId) => {
        const capability = capabilityBySnapshotId.get(snapshotId);
        if (!capability) {
          throw new Error(
            `Market Research Plan references unavailable capability snapshot ${snapshotId}.`,
          );
        }
        if (!enabled.has(capability.providerId)) return [];
        if (
          !capability.sourceTypes.some((sourceType) =>
            route.providerSourceTypes.includes(sourceType),
          )
        ) {
          throw new Error(
            `Capability snapshot ${snapshotId} cannot execute route ${route.id}.`,
          );
        }
        return [{ route, capability }];
      }),
    );
    const providers = [
      ...new Map(
        providerCandidates
          .sort(
            (a, b) =>
              a.route.priority - b.route.priority ||
              compareText(a.capability.providerId, b.capability.providerId),
          )
          .map(({ route, capability }) => {
            const provider: SegmentProviderRouteV2["providers"][number] = {
              providerId: capability.providerId,
              role: route.role,
              priority: route.priority,
              reasons: [`Market Research Plan route ${route.id}: ${route.rationale}`],
              unsupportedConstraints: [],
            };
            return [capability.providerId, provider] as const;
          }),
      ).values(),
    ];
    if (!providers.length) {
      throw new Error(`No enabled provider can execute Segment ${segment.id}.`);
    }
    return { segmentId: segment.id, providers };
  });
  const usedProviderIds = new Set(
    routes.flatMap(({ providers }) => providers.map(({ providerId }) => providerId)),
  );
  const capabilities = [
    ...new Map(
      input.providerCapabilities
        .filter(({ capabilities }) => usedProviderIds.has(capabilities.providerId))
        .map(({ capabilities }) => [capabilities.providerId, capabilities] as const),
    ).values(),
  ];
  return compileDiscoveryPlanV2({
    id: input.id,
    workspaceId: input.workspaceId,
    strategy: input.strategy,
    segments: segmentInputs,
    marketResearchPlanVersionId: input.researchPlan.id,
    routes,
    providerCapabilities: capabilities,
    versionNumber: input.versionNumber,
    marketBreadth: input.researchPlan.marketBreadth,
    ...(input.researchPlan.estimatedCandidateRange
      ? { estimatedCandidateRange: input.researchPlan.estimatedCandidateRange }
      : {}),
    maximumProviderCalls: input.maximumProviderCalls,
    ...(input.maximumEstimatedCostMinor === undefined
      ? {}
      : { maximumEstimatedCostMinor: input.maximumEstimatedCostMinor }),
    ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}),
    compiledAt: input.compiledAt,
  });
}

function compileOpportunitySegments(
  input: Parameters<typeof compileDiscoveryPlanFromMarketResearchPlan>[0],
) {
  if (!input.researchPlan.opportunityLanes.length) {
    return input.strategy.discoverySegments;
  }
  const template = input.strategy.discoverySegments[0]!;
  return input.researchPlan.opportunityLanes.filter(isRoutableLane).flatMap((lane) => {
    const existing = lane.sourceArchetypeId
      ? input.strategy.discoverySegments.filter(
          ({ archetypeId }) => archetypeId === lane.sourceArchetypeId,
        )
      : [];
    if (existing.length) {
      return existing.map((segment) => ({
        ...segment,
        opportunityLaneId: lane.id,
        label: lane.label,
        rationale: lane.rationale,
        businessCharacteristics: {
          ...segment.businessCharacteristics,
          businessModels: uniqueSorted([
            ...segment.businessCharacteristics.businessModels,
            ...lane.businessModels,
          ]),
          industries: uniqueSorted([
            ...segment.businessCharacteristics.industries,
            ...lane.industries,
          ]),
          keywords: uniqueSorted([
            ...segment.businessCharacteristics.keywords,
            ...lane.vocabulary,
            ...lane.scaleDrivers,
            ...lane.buyingTriggers,
          ]),
        },
        priority: lanePriority(lane.disposition),
        explorationBudgetClass: laneBudget(lane.disposition),
      }));
    }
    return [
      {
        id: `segment.${lane.id}`,
        strategyVersionId: input.strategy.id,
        // Compatibility field for downstream records; opportunityLaneId is canonical.
        archetypeId: lane.id,
        opportunityLaneId: lane.id,
        label: lane.label,
        rationale: lane.rationale,
        geography: input.strategy.geography,
        businessCharacteristics: {
          organizationRoles: [lane.organizationType],
          businessModels: lane.businessModels,
          industries: lane.industries,
          keywords: uniqueSorted([
            ...lane.vocabulary,
            ...lane.scaleDrivers,
            ...lane.buyingTriggers,
          ]),
        },
        relationshipType: input.strategy.objective.targetRelationshipTypes[0]!,
        useModes: template.useModes,
        positiveSignals: [],
        negativeSignals: [],
        exclusionRules: template.exclusionRules,
        priority: lanePriority(lane.disposition),
        explorationBudgetClass: laneBudget(lane.disposition),
      },
    ];
  });
}

function isRoutableLane(
  lane: MarketResearchPlan["opportunityLanes"][number],
): lane is MarketResearchPlan["opportunityLanes"][number] & {
  disposition: "priority" | "secondary" | "exploratory";
} {
  return ["priority", "secondary", "exploratory"].includes(lane.disposition);
}

function routesForSegment(
  plan: MarketResearchPlan,
  segment: { archetypeId: string; opportunityLaneId?: string },
) {
  return plan.discoveryRoutes.filter(
    ({ archetypeIds, opportunityLaneIds }) =>
      (segment.opportunityLaneId &&
        opportunityLaneIds.includes(segment.opportunityLaneId)) ||
      archetypeIds.includes(segment.archetypeId),
  );
}

function lanePriority(disposition: "priority" | "secondary" | "exploratory") {
  return disposition === "priority" ? 1 : disposition === "secondary" ? 35 : 70;
}

function laneBudget(disposition: "priority" | "secondary" | "exploratory") {
  return disposition === "priority"
    ? ("high" as const)
    : disposition === "secondary"
      ? ("medium" as const)
      : ("low" as const);
}

function assertIdentity(
  input: Parameters<typeof compileDiscoveryPlanFromMarketResearchPlan>[0],
) {
  if (input.strategy.status !== "confirmed") {
    throw new Error("Discovery planning requires a confirmed Campaign Strategy.");
  }
  if (
    input.researchPlan.workspaceId !== input.workspaceId ||
    input.researchPlan.campaignId !== input.strategy.campaignId
  ) {
    throw new Error("Market Research Plan does not match the Discovery Campaign.");
  }
  const expectedSnapshots = new Set(input.researchPlan.providerCapabilitySnapshotIds);
  const suppliedSnapshots = input.providerCapabilities.map(
    ({ snapshotId }) => snapshotId,
  );
  if (
    suppliedSnapshots.length !== expectedSnapshots.size ||
    suppliedSnapshots.some((id) => !expectedSnapshots.has(id))
  ) {
    throw new Error("Discovery did not load the exact frozen provider capability set.");
  }
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
