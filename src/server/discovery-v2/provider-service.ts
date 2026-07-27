import {
  discoveryProviderCapabilitiesSchema,
  providerDiscoveryRequestSchema,
  providerDiscoveryResponseSchema,
  type CompanyDiscoveryProvider,
} from "@/lib/discovery-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { persistProviderResponse } from "./provider-repository";

export async function executeAndPersistDiscoveryProvider(input: {
  provider: CompanyDiscoveryProvider;
  request: unknown;
  normalizationVersion: string;
}) {
  const request = providerDiscoveryRequestSchema.parse(input.request);
  const capabilities = discoveryProviderCapabilitiesSchema.parse(
    await input.provider.getCapabilities(),
  );
  if (
    capabilities.providerId !== input.provider.id ||
    capabilities.providerVersion !== input.provider.version
  ) {
    throw new Error("Discovery provider capability identity mismatch.");
  }
  const response = providerDiscoveryResponseSchema.parse(
    await input.provider.search(request),
  );
  if (response.providerId !== input.provider.id) {
    throw new Error("Discovery provider response identity mismatch.");
  }
  const execution = await persistProviderResponse({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    planKey: request.discoveryPlanId,
    segmentKey: request.segment.id,
    providerKey: input.provider.id,
    adapterVersion: input.provider.version,
    capabilities,
    capabilitiesHash: hashCanonical(capabilities),
    executionKey: response.executionId,
    requestHash: hashCanonical(request),
    request,
    response,
    normalizationVersion: input.normalizationVersion,
  });
  return { execution, response, capabilities };
}
