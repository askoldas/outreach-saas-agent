import {
  routeDiscoverySegment,
  type DiscoveryProviderRegistry,
  type ProviderDiscoveryRequest,
  type SegmentProviderRouteV2,
} from "@/lib/discovery-v2";

export async function routeSemanticSegments(input: {
  registry: DiscoveryProviderRegistry;
  requests: ProviderDiscoveryRequest[];
  enabledProviderIds: string[];
}) {
  const routes: SegmentProviderRouteV2[] = [];
  for (const request of input.requests) {
    routes.push(
      await routeDiscoverySegment({
        registry: input.registry,
        request,
        enabledProviderIds: input.enabledProviderIds,
      }),
    );
  }
  return routes;
}
