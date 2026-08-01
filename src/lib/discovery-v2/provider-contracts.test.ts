import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import {
  providerDiscoveryResponseSchema,
  type DiscoveryProviderCapabilities,
  type ProviderDiscoveryRequest,
} from "./contracts.ts";
import type { CompanyDiscoveryProvider } from "./provider.ts";
import { DiscoveryProviderRegistry } from "./provider-registry.ts";
import { routeDiscoverySegment } from "./provider-router.ts";

test("the registry rejects duplicates and unknown providers", () => {
  const provider = fakeProvider("web", capabilities("web"));
  assert.throws(
    () => new DiscoveryProviderRegistry([provider, provider]),
    /Duplicate discovery provider/,
  );
  assert.throws(() => new DiscoveryProviderRegistry([]).get("missing"), /not registered/);
});

test("routing is deterministic and retains unsupported semantic constraints", async () => {
  const broad = fakeProvider("broad", capabilities("broad"));
  const limited = fakeProvider("limited", capabilities("limited", false));
  const registry = new DiscoveryProviderRegistry([limited, broad]);
  const route = await routeDiscoverySegment({
    registry,
    request: request(),
    enabledProviderIds: ["limited", "broad"],
  });

  assert.deepEqual(
    route.providers.map(({ providerId }) => providerId),
    ["broad", "limited"],
  );
  assert.equal(route.providers[0]?.role, "primary");
  assert.ok(route.providers[1]?.unsupportedConstraints.includes("country_filter"));
  assert.ok(route.providers[1]?.unsupportedConstraints.includes("industry_filter"));
});

test("routing fails closed when no enabled provider supports the segment", async () => {
  const unsupported = fakeProvider("unsupported", capabilities("unsupported"), false);
  await assert.rejects(
    routeDiscoverySegment({
      registry: new DiscoveryProviderRegistry([unsupported]),
      request: request(),
      enabledProviderIds: ["unsupported"],
    }),
    /No enabled discovery provider/,
  );
});

test("provider responses cannot attach candidates to unknown records or add fit scores", () => {
  const response = validResponse();
  assert.equal(providerDiscoveryResponseSchema.parse(response).records.length, 1);
  assert.throws(() =>
    providerDiscoveryResponseSchema.parse({
      ...response,
      normalizedCandidates: [
        { ...response.normalizedCandidates[0], sourceRecordKey: "unknown" },
      ],
    }),
  );
  assert.throws(() =>
    providerDiscoveryResponseSchema.parse({
      ...response,
      normalizedCandidates: [{ ...response.normalizedCandidates[0], finalFitScore: 95 }],
    }),
  );
});

function fakeProvider(
  id: string,
  declaredCapabilities: DiscoveryProviderCapabilities,
  supported = true,
): CompanyDiscoveryProvider {
  return {
    id,
    version: "1.0",
    async getCapabilities() {
      return declaredCapabilities;
    },
    async estimate() {
      return {
        providerId: id,
        supported,
        unsupportedConstraints: [],
        estimatedCostMinor: id === "broad" ? 10 : 1,
        warnings: [],
      };
    },
    async search() {
      return validResponse(id);
    },
  };
}

function capabilities(providerId: string, filters = true): DiscoveryProviderCapabilities {
  return {
    providerId,
    providerVersion: "1.0",
    sourceTypes: ["web_search"],
    supports: {
      countryFilter: filters,
      regionFilter: filters,
      localityFilter: filters,
      languageTargeting: filters,
      industryFilter: filters,
      keywordFilter: filters,
      companySizeFilter: filters,
      employeeRangeFilter: filters,
      revenueRangeFilter: false,
      technologyFilter: false,
      businessModelFilter: filters,
      ownershipFilter: false,
      jobSignalFilter: false,
      fundingSignalFilter: false,
      pagination: true,
      totalCountEstimate: false,
      recordFreshness: false,
    },
    costModel: { type: "per_call", currency: "EUR", estimatedMinorPerCall: 1 },
  };
}

function request(): ProviderDiscoveryRequest {
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
    budget: { maxResults: 25, maxCalls: 5 },
  };
}

function validResponse(providerId = "web") {
  return {
    providerId,
    executionId: "execution-1",
    records: [
      {
        sourceRecordKey: "record-1",
        providerRecordId: "record-1",
        sourceType: "web_search" as const,
        sourceUrl: "https://example.com",
        resultRank: 1,
        queryOrFilterFingerprint: "query-hash",
        rawPayload: { title: "Example" },
        rawPayloadHash: "a".repeat(64),
        retrievedAt: "2026-07-28T10:00:00.000Z",
      },
    ],
    normalizedCandidates: [
      {
        sourceRecordKey: "record-1",
        name: "Example",
        websiteUrl: "https://example.com",
        matchedSegmentId: "segment-1",
        matchedArchetypeId: "archetype-1",
        matchedSignals: [],
        preliminaryQuality: {
          likelyOperatingOrganization: null,
          likelyTargetGeography: null,
          hasUsableIdentity: true,
          confidence: 0.5,
        },
        createdAt: "2026-07-28T10:00:00.000Z",
      },
    ],
    exhausted: true,
    usage: { calls: 1, recordsReturned: 1, runtimeMs: 100 },
    warnings: [],
    errors: [],
  };
}
