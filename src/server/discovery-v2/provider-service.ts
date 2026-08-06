import {
  discoveryProviderCapabilitiesSchema,
  providerDiscoveryRequestSchema,
  providerDiscoveryResponseSchema,
  type CompanyDiscoveryProvider,
  type DiscoveryProviderCapabilities,
  type ProviderDiscoveryExecutionPlan,
} from "@/lib/discovery-v2";
import { refinePlausibleCandidateClassifications } from "@/lib/discovery-v2/candidate-preclassification-model";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import {
  findPersistedProviderExecution,
  persistProviderResponse,
  recordCandidatePreclassificationModelCall,
} from "./provider-repository";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";

export async function executeAndPersistDiscoveryProvider(input: {
  provider?: CompanyDiscoveryProvider;
  providerId: string;
  providerVersion: string;
  frozenCapabilities: DiscoveryProviderCapabilities;
  frozenCapabilitiesHash: string;
  request: unknown;
  executionPlan?: ProviderDiscoveryExecutionPlan;
  normalizationVersion: string;
  assertConfigured?: () => void | Promise<void>;
}) {
  const request = providerDiscoveryRequestSchema.parse(input.request);
  const frozenCapabilities = discoveryProviderCapabilitiesSchema.parse(
    input.frozenCapabilities,
  );
  if (
    frozenCapabilities.providerId !== input.providerId ||
    frozenCapabilities.providerVersion !== input.providerVersion ||
    hashCanonical(frozenCapabilities) !== input.frozenCapabilitiesHash
  ) {
    throw new Error("Frozen Discovery provider capability identity mismatch.");
  }
  const requestHash = hashCanonical({
    request,
    executionPlan: input.executionPlan ?? null,
    normalizationVersion: input.normalizationVersion,
  });
  const cached = await findPersistedProviderExecution({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    segmentKey: request.segment.id,
    providerKey: input.providerId,
    adapterVersion: input.providerVersion,
    requestHash,
  });
  if (cached) {
    return {
      capabilities: frozenCapabilities,
      cached: true as const,
      summary: cached,
    };
  }

  if (!input.provider) {
    throw new Error(
      `Discovery provider is required for uncached execution: ${input.providerId}.`,
    );
  }
  if (
    input.provider.id !== input.providerId ||
    input.provider.version !== input.providerVersion
  ) {
    throw new Error("Discovery provider adapter identity mismatch.");
  }
  const currentCapabilities = discoveryProviderCapabilitiesSchema.parse(
    await input.provider.getCapabilities(),
  );
  if (
    currentCapabilities.providerId !== input.providerId ||
    currentCapabilities.providerVersion !== input.providerVersion ||
    hashCanonical(currentCapabilities) !== input.frozenCapabilitiesHash
  ) {
    throw new Error("Discovery provider capabilities changed after plan freeze.");
  }
  assertIntelligenceExternalCallsAllowed("provider");
  await input.assertConfigured?.();
  const normalizedResponse = providerDiscoveryResponseSchema.parse(
    await input.provider.search(request, input.executionPlan),
  );
  if (
    normalizedResponse.classifications.some(({ disposition }) =>
      ["candidate", "needs_review"].includes(disposition),
    )
  ) {
    assertIntelligenceExternalCallsAllowed("model");
  }
  const refinement = await refinePlausibleCandidateClassifications({
    request,
    response: normalizedResponse,
    runtime: {
      recordAttempt: createIntelligenceAttemptRecorder({
        workspaceId: request.workspaceId,
        frozenInputHash: requestHash,
        metadata: {
          campaignId: request.campaignId,
          segmentId: request.segment.id,
          providerId: input.providerId,
        },
      }),
    },
  });
  const response = refinement.response;
  if (refinement.call) {
    await recordCandidatePreclassificationModelCall({
      workspaceId: request.workspaceId,
      campaignId: request.campaignId,
      segmentId: request.segment.id,
      requestHash,
      call: refinement.call,
    });
  }
  if (response.providerId !== input.providerId) {
    throw new Error("Discovery provider response identity mismatch.");
  }
  if (
    response.records.length === 0 &&
    response.errors.length > 0 &&
    response.errors.every(({ retryable }) => retryable)
  ) {
    throw Object.assign(
      new Error(
        `Discovery provider returned only retryable failures: ${input.providerId}.`,
      ),
      { code: "provider_unavailable", retryable: true },
    );
  }
  const execution = await persistProviderResponse({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    planKey: request.discoveryPlanId,
    segmentKey: request.segment.id,
    providerKey: input.providerId,
    adapterVersion: input.providerVersion,
    capabilities: frozenCapabilities,
    capabilitiesHash: input.frozenCapabilitiesHash,
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
    providerKey: input.providerId,
    adapterVersion: input.providerVersion,
    requestHash,
  });
  if (!persisted)
    throw new Error("Discovery provider response was not durably persisted.");
  return {
    execution,
    response,
    capabilities: frozenCapabilities,
    cached: false as const,
    summary: { ...persisted, cached: false as const },
  };
}
