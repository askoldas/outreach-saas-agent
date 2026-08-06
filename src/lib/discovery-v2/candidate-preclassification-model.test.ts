import assert from "node:assert/strict";
import test from "node:test";
import type { AiCallResult } from "../providers/openrouter.ts";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import { WebSearchProvider } from "./providers/web-search-provider.ts";
import { refinePlausibleCandidateClassifications } from "./candidate-preclassification-model.ts";
import type { ProviderDiscoveryRequest } from "./contracts.ts";

test("model refinement is evidence-bounded and can reject only plausible pages", async () => {
  const request = discoveryRequest();
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "Ambiguous Operations",
        url: "https://ambiguous.example/about",
        content: "We supply industrial components.",
        score: 0.8,
      },
      {
        title: "Industry directory",
        url: "https://directory.example/members",
        content: "Member directory.",
        score: 0.7,
      },
    ],
    () => "2026-08-02T10:00:00.000Z",
    () => "execution-1",
  );
  // Use neutral deterministic evidence so the plausible page reaches model refinement.
  const response = await provider.search({
    ...request,
    segment: { ...request.segment, relationshipType: "supplier" },
  });
  const plausibleKey = response.normalizedCandidates[0]!.sourceRecordKey;
  const refined = await refinePlausibleCandidateClassifications({
    request: {
      ...request,
      segment: { ...request.segment, relationshipType: "supplier" },
    },
    response,
    generate: async () =>
      fakeCall({
        classifications: [
          {
            sourceRecordKey: plausibleKey,
            probableRelationshipTypes: ["competitor"],
            objectiveCompatibility: "incompatible",
            reasonCode: "explicit_incompatible_commercial_role",
            confidence: 0.8,
          },
        ],
      }),
  });
  assert.equal(refined.response.normalizedCandidates.length, 0);
  assert.equal(
    refined.response.classifications.find(
      ({ sourceRecordKey }) => sourceRecordKey === plausibleKey,
    )?.disposition,
    "reject",
  );
  assert.equal(
    refined.response.classifications.find(
      ({ disposition }) => disposition === "source_only",
    )?.classifierVersion,
    "commercial-candidate-preclassification/v1.0",
  );
});

function discoveryRequest(): ProviderDiscoveryRequest {
  const strategy = createNativeCampaignStrategyFixture();
  return {
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    discoveryPlanId: "plan-1",
    segment: strategy.discoverySegments[0]!,
    executionContext: {
      passNumber: 1,
      previousExecutionIds: [],
      excludedCanonicalKeys: [],
      previousQueryFingerprints: [],
    },
    budget: { maxCalls: 1, maxResults: 5 },
  };
}

function fakeCall(data: unknown): AiCallResult<string> {
  return {
    data: JSON.stringify(data),
    provider: "openrouter",
    requestedModel: "openai/gpt-5-mini",
    actualModel: "openai/gpt-5-mini",
    fallbackUsed: false,
    latencyMs: 10,
  };
}
