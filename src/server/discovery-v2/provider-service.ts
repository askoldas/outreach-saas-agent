import {
  discoveryProviderCapabilitiesSchema,
  providerDiscoveryRequestSchema,
  providerDiscoveryResponseSchema,
  type CompanyDiscoveryProvider,
} from "@/lib/discovery-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import {
  findPersistedProviderExecution,
  persistProviderResponse,
} from "./provider-repository";

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
  const requestHash = hashCanonical(request);
  const cached = await findPersistedProviderExecution({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    segmentKey: request.segment.id,
    providerKey: input.provider.id,
    adapterVersion: input.provider.version,
    requestHash,
  });
  if (cached) return { capabilities, cached: true as const, summary: cached };

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
    requestHash,
    request,
    response,
    normalizationVersion: input.normalizationVersion,
  });
  const persisted = await findPersistedProviderExecution({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    segmentKey: request.segment.id,
    providerKey: input.provider.id,
    adapterVersion: input.provider.version,
    requestHash,
  });
  if (!persisted)
    throw new Error("Discovery provider response was not durably persisted.");
  return {
    execution,
    response,
    capabilities,
    cached: false as const,
    summary: { ...persisted, cached: false as const },
  };
}
