import {
  discoveryProviderCapabilitiesSchema,
  providerDiscoveryEstimateSchema,
  providerDiscoveryRequestSchema,
  type DiscoveryProviderCapabilities,
  type ProviderDiscoveryRequest,
} from "./contracts.ts";
import type { DiscoveryProviderRegistry } from "./provider-registry.ts";

export type SegmentProviderRoute = {
  segmentId: string;
  providers: Array<{
    providerId: string;
    role: "primary" | "supporting" | "verification";
    priority: number;
    reasons: string[];
    unsupportedConstraints: string[];
  }>;
};

export async function routeDiscoverySegment(input: {
  registry: DiscoveryProviderRegistry;
  request: ProviderDiscoveryRequest;
  enabledProviderIds: string[];
}): Promise<SegmentProviderRoute> {
  const request = providerDiscoveryRequestSchema.parse(input.request);
  const enabled = new Set(input.enabledProviderIds);
  const candidates = input.registry.list().filter((provider) => enabled.has(provider.id));
  const evaluated = await Promise.all(
    candidates.map(async (provider) => {
      const capabilities = discoveryProviderCapabilitiesSchema.parse(
        await provider.getCapabilities(),
      );
      if (
        capabilities.providerId !== provider.id ||
        capabilities.providerVersion !== provider.version
      ) {
        throw new Error(`Provider capability identity mismatch: ${provider.id}.`);
      }
      const estimate = providerDiscoveryEstimateSchema.parse(
        await provider.estimate(request),
      );
      if (estimate.providerId !== provider.id) {
        throw new Error(`Provider estimate identity mismatch: ${provider.id}.`);
      }
      const unsupported = new Set([
        ...unsupportedSemanticConstraints(request, capabilities.supports),
        ...estimate.unsupportedConstraints,
      ]);
      return {
        providerId: provider.id,
        supported: estimate.supported,
        unsupportedConstraints: [...unsupported].sort(),
        estimatedCostMinor: estimate.estimatedCostMinor,
        sourceDiversity: capabilities.sourceTypes.length,
      };
    }),
  );

  const routable = evaluated
    .filter((provider) => provider.supported)
    .sort(
      (left, right) =>
        left.unsupportedConstraints.length - right.unsupportedConstraints.length ||
        (left.estimatedCostMinor ?? Number.POSITIVE_INFINITY) -
          (right.estimatedCostMinor ?? Number.POSITIVE_INFINITY) ||
        right.sourceDiversity - left.sourceDiversity ||
        compareText(left.providerId, right.providerId),
    );
  if (!routable.length) {
    throw new Error("No enabled discovery provider supports this segment.");
  }
  return {
    segmentId: request.segment.id,
    providers: routable.map((provider, index) => ({
      providerId: provider.providerId,
      role: index === 0 ? "primary" : "supporting",
      priority: index + 1,
      reasons: [
        index === 0 ? "Best enabled capability match." : "Adds enabled source coverage.",
      ],
      unsupportedConstraints: provider.unsupportedConstraints,
    })),
  };
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unsupportedSemanticConstraints(
  request: ProviderDiscoveryRequest,
  supports: DiscoveryProviderCapabilities["supports"],
) {
  const constraints: string[] = [];
  const segment = request.segment;
  if (segment.geography.countryCodes.length && !supports.countryFilter)
    constraints.push("country_filter");
  if (segment.geography.includedRegions.length && !supports.regionFilter)
    constraints.push("region_filter");
  if (segment.geography.includedCities.length && !supports.localityFilter)
    constraints.push("locality_filter");
  if (segment.businessCharacteristics.industries.length && !supports.industryFilter)
    constraints.push("industry_filter");
  if (segment.businessCharacteristics.keywords.length && !supports.keywordFilter)
    constraints.push("keyword_filter");
  if (
    segment.businessCharacteristics.businessModels.length &&
    !supports.businessModelFilter
  )
    constraints.push("business_model_filter");
  if (segment.businessCharacteristics.sizeRange && !supports.employeeRangeFilter)
    constraints.push("employee_range_filter");
  return constraints;
}
