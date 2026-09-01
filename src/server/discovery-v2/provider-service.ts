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
  persistDiscoverySourceExpansions,
  recordCandidatePreclassificationModelCall,
} from "./provider-repository";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";
import { runBudgetedTavilyCall } from "@/server/credits/budgeted-tavily-call";
import { runBudgetedOpenRouterCall } from "@/server/credits/budgeted-provider-call";
import { generateTextResult } from "@/lib/providers/openrouter";

export async function executeAndPersistDiscoveryProvider(input: {
  campaignRunId: string;
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
  const providerResponse =
    input.providerId === "web_search"
      ? await runBudgetedTavilyCall({
          workspaceId: request.workspaceId,
          campaignRunId: input.campaignRunId,
          operation: "company_research_web_search",
          idempotencyKey: `company-research-search:${input.campaignRunId}:${requestHash}`,
          estimatedProviderCredits: Math.max(
            1,
            Array.isArray(input.executionPlan?.queries)
              ? input.executionPlan.queries.length
              : 1,
          ),
          execute: () => input.provider!.search(request, input.executionPlan),
          usage: (result) => {
            const parsed = providerDiscoveryResponseSchema.parse(result);
            return {
              providerCredits:
                parsed.usage.providerCredits ?? parsed.usage.calls,
              providerRequestId:
                parsed.usage.providerRequestIds?.length === 1
                  ? parsed.usage.providerRequestIds[0]
                  : undefined,
              providerRequestIds: parsed.usage.providerRequestIds,
            };
          },
        })
      : await input.provider.search(request, input.executionPlan);
  const normalizedResponse = providerDiscoveryResponseSchema.parse(providerResponse);
  if (
    normalizedResponse.classifications.some(({ disposition }) =>
      ["candidate", "needs_review"].includes(disposition),
    )
  ) {
    assertIntelligenceExternalCallsAllowed("model");
  }
  let preclassificationAttempt = 0;
  const refinement = await refinePlausibleCandidateClassifications({
    request,
    response: normalizedResponse,
    generate: (messages, options) => {
      preclassificationAttempt += 1;
      return runBudgetedOpenRouterCall({
        workspaceId: request.workspaceId,
        campaignRunId: input.campaignRunId,
        operation: "company_research_source_preclassification",
        idempotencyKey: `company-research-preclassification:${input.campaignRunId}:${requestHash}:attempt-${preclassificationAttempt}`,
        billable: preclassificationAttempt === 1,
        execute: () => generateTextResult(messages, options),
      });
    },
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
  const directResponse = {
    ...response,
    normalizedCandidates: response.normalizedCandidates.filter(
      ({ discoverySource }) => !discoverySource,
    ),
  };
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
    response: directResponse,
    normalizationVersion: input.normalizationVersion,
  });
  await persistDiscoverySourceExpansions({
    workspaceId: request.workspaceId,
    campaignId: request.campaignId,
    executionId: String((execution as { id: unknown }).id),
    segmentKey: request.segment.id,
    archetypeKey: request.segment.archetypeId,
    normalizationVersion: input.normalizationVersion,
    records: response.records,
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
