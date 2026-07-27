import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignStrategyVersion } from "@/types/domain";
import type { ProviderDiscoveryRequest } from "../contracts.ts";
import { createConfiguredDiscoveryProviderRegistry } from "../configured-provider-registry.ts";
import { adaptV1StrategyToV2Draft } from "../../intelligence/campaign-strategy-v2/v1-adapter.ts";
import {
  fingerprintWebQuery,
  generateWebDiscoveryQueries,
  normalizeWebQuery,
} from "./web-query-generator.ts";
import { WebSearchProvider } from "./web-search-provider.ts";

test("V2 web queries are semantic, bounded, localized, and deterministic", () => {
  const input = request();
  input.segment.geography.localLanguages = ["Lithuanian"];
  input.budget.maxCalls = 4;
  const first = generateWebDiscoveryQueries(input);
  const second = generateWebDiscoveryQueries(input);

  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
  assert.ok(first.every((query) => query.query.includes("Lithuania")));
  assert.ok(first.every((query) => query.query.length <= 240));
  assert.equal(new Set(first.map(({ fingerprint }) => fingerprint)).size, first.length);

  const localInput = request();
  localInput.segment.geography.localLanguages = ["Lithuanian"];
  localInput.budget.maxCalls = 10;
  assert.ok(
    generateWebDiscoveryQueries(localInput).some(
      (query) => query.family === "local_language" && /įmonė|tiekėjas/.test(query.query),
    ),
  );
});

test("WebSearchProvider is available only through the configured registry", () => {
  const registry = createConfiguredDiscoveryProviderRegistry();
  assert.equal(registry.get("web_search").version, "2.0");
  assert.deepEqual(
    registry.list().map(({ id }) => id),
    ["web_search"],
  );
});

test("completed equivalent queries are skipped by fingerprint", () => {
  const input = request();
  const first = generateWebDiscoveryQueries(input)[0]!;
  input.executionContext.previousQueryFingerprints = [
    fingerprintWebQuery(normalizeWebQuery(first.query)),
  ];
  assert.ok(
    generateWebDiscoveryQueries(input).every(
      ({ fingerprint }) => fingerprint !== first.fingerprint,
    ),
  );
});

test("WebSearchProvider bounds calls and records while preserving raw provenance", async () => {
  const calls: string[] = [];
  const provider = new WebSearchProvider(
    async (query) => {
      calls.push(query);
      return [
        {
          title: "Acme Manufacturing",
          url: "https://acme.example/",
          content: "Industrial operator in Lithuania.",
          score: 0.8,
        },
        {
          title: "Manufacturers association members directory",
          url: "https://association.example/members",
          content: "Members directory and company list.",
          score: 0.7,
        },
      ];
    },
    () => "2026-07-28T10:00:00.000Z",
    () => "execution-1",
  );
  const input = request();
  input.budget = { maxCalls: 2, maxResults: 3 };
  const response = await provider.search(input);

  assert.equal(calls.length, 2);
  assert.equal(response.records.length, 3);
  assert.equal(response.usage.recordsReturned, 3);
  assert.ok(response.records.every(({ rawPayloadHash }) => rawPayloadHash.length === 64));
  assert.ok(
    response.records.some(({ sourceType }) => sourceType === "industry_directory"),
  );
  assert.equal(response.normalizedCandidates.length, 2);
  assert.ok(
    response.normalizedCandidates.every((candidate) => !("finalFitScore" in candidate)),
  );
});

test("directory pages are retained but not treated as company candidates", async () => {
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "Association members directory",
        url: "https://association.example/members",
        content: "Companies list.",
        score: 0.7,
      },
    ],
    () => "2026-07-28T10:00:00.000Z",
    () => "execution-2",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);
  assert.equal(response.records.length, 1);
  assert.equal(response.normalizedCandidates.length, 0);
});

test("individual Tavily failures are bounded and classified", async () => {
  const provider = new WebSearchProvider(
    async () => {
      throw new Error("Tavily search failed with status 429.");
    },
    () => "2026-07-28T10:00:00.000Z",
    () => "execution-3",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);
  assert.equal(response.errors[0]?.code, "rate_limit");
  assert.equal(response.errors[0]?.retryable, true);
  assert.equal(response.records.length, 0);
});

function request(): ProviderDiscoveryRequest {
  const strategy = adaptV1StrategyToV2Draft({
    campaignId: "campaign-1",
    strategyDraftId: "strategy-1",
    companyProfileVersionId: "profile-1",
    offeringId: "offering-1",
    offeringVersionId: "offering-version-1",
    memorySnapshotId: "memory-1",
    geography: {
      displayName: "Lithuania",
      countryCodes: ["LT"],
      workingLanguages: ["English"],
    },
    strategy: legacyStrategy(),
  });
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
    budget: { maxCalls: 6, maxResults: 25 },
  };
}

function legacyStrategy(): CampaignStrategyVersion {
  return {
    id: "legacy-1",
    version: 1,
    status: "ready",
    targetGeography: "Lithuania",
    companyTypes: ["Manufacturer"],
    industries: ["Industrial equipment"],
    characteristics: ["Operates production facilities"],
    relevanceReasons: ["May need operational software"],
    opportunityAssumptions: ["Operations are managed locally"],
    qualificationCriteria: ["Has an operations team"],
    positiveSignals: ["Multiple production sites"],
    exclusions: ["Software vendors"],
    contactRoles: ["Operations director"],
    contactDepartments: ["Operations"],
    acceptableContactRoutes: ["business_email"],
    searchLanguages: ["English"],
    sourceCategories: ["company_website"],
    searchTerms: ["legacy query"],
    localizedTerms: [],
    limitations: [],
    targetCompanyCount: 25,
    refinementSummary: ["Target industrial operators."],
  };
}
