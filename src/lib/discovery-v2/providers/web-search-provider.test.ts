import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderDiscoveryRequest } from "../contracts.ts";
import { createConfiguredDiscoveryProviderRegistry } from "../configured-provider-registry.ts";
import { createNativeCampaignStrategyFixture } from "../../intelligence/campaign-strategy-v2/test-fixture.ts";
import {
  areNearDuplicateQueries,
  expandContextualAcronyms,
  generateWebDiscoveryQueries,
  normalizeWebQuery,
} from "./web-query-generator.ts";
import { classifyWebResult } from "./web-normalization.ts";
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
  assert.equal(normalizeWebQuery("  INDUSTRY   I  "), "industry i");

  const localInput = request();
  localInput.segment.geography.localLanguages = ["Lithuanian"];
  localInput.budget.maxCalls = 10;
  const broadQueries = generateWebDiscoveryQueries(localInput);
  assert.ok(
    broadQueries.some(
      (query) =>
        query.family === "local_language" && /pirkėjas|naudotojas/.test(query.query),
    ),
  );
  assert.ok(
    broadQueries.some(
      (query) => query.family === "archetype" && query.query.includes("official website"),
    ),
  );
  assert.ok(
    broadQueries.every(
      (query) => !/\b(?:supplier|manufacturer|distributor|reseller)\b/i.test(query.query),
    ),
  );
  assert.ok(broadQueries.every((query) => query.expectedInformationGain));
});

test("relationship vocabulary changes materially by Campaign objective", () => {
  const buyer = request();
  buyer.budget.maxCalls = 10;
  const buyerQueries = generateWebDiscoveryQueries(buyer);
  const distributor = request();
  distributor.segment = {
    ...distributor.segment,
    relationshipType: "distributor",
    useModes: ["distribute"],
  };
  distributor.budget.maxCalls = 10;
  const distributorQueries = generateWebDiscoveryQueries(distributor);
  assert.ok(
    distributorQueries.some((query) =>
      /\b(?:distributor|wholesaler|importer)\b/i.test(query.query),
    ),
  );
  assert.notDeepEqual(
    buyerQueries.map((query) => query.normalizedQuery),
    distributorQueries.map((query) => query.normalizedQuery),
  );
});

test("web planning expands contextual acronyms and allocates distinct query/source families", () => {
  assert.equal(
    expandContextualAcronyms("API manufacturer", ["active pharmaceutical ingredient"]),
    '"active pharmaceutical ingredient" manufacturer',
  );
  assert.equal(
    expandContextualAcronyms("API manufacturer", ["application programming interface"]),
    '"application programming interface" manufacturer',
  );
  assert.equal(expandContextualAcronyms("API manufacturer", []), "API manufacturer");

  const input = request();
  input.budget.maxCalls = 10;
  const queries = generateWebDiscoveryQueries(input);
  assert.ok(new Set(queries.map(({ family }) => family)).size >= 4);
  assert.ok(new Set(queries.map(({ sourceFamily }) => sourceFamily)).size >= 3);
  assert.ok(
    queries.every((query, index) =>
      queries
        .slice(index + 1)
        .every(
          (other) =>
            !areNearDuplicateQueries(query.normalizedQuery, other.normalizedQuery),
        ),
    ),
  );
});

test("supplier Campaigns may use supplier and manufacturer vocabulary", () => {
  const input = request();
  input.segment = {
    ...input.segment,
    relationshipType: "supplier",
    useModes: ["use"],
  };
  input.budget.maxCalls = 10;
  assert.ok(
    generateWebDiscoveryQueries(input).some((query) =>
      /\b(?:supplier|manufacturer)\b/i.test(query.query),
    ),
  );
});

test("local-language role vocabulary follows the relationship", () => {
  const input = request();
  input.segment = {
    ...input.segment,
    relationshipType: "distributor",
    useModes: ["distribute"],
    geography: {
      ...input.segment.geography,
      localLanguages: ["German"],
      workingLanguages: ["German", "English"],
    },
  };
  input.budget.maxCalls = 10;
  assert.ok(
    generateWebDiscoveryQueries(input).some(
      (query) =>
        query.family === "local_language" &&
        /Händler|Großhändler|Importeur/.test(query.query),
    ),
  );
});

test("seed expansion is not issued without real seed organizations", () => {
  const input = request();
  input.executionContext = {
    ...input.executionContext,
    passNumber: 2,
    targetedActions: [
      {
        gapId: "seed-gap",
        type: "expand_from_seed",
        reason: "Try known entities.",
        expectedImprovement: "More candidates.",
        maxCalls: 1,
      },
    ],
  };
  assert.deepEqual(generateWebDiscoveryQueries(input), []);
});

test("multi-country discovery gives every Baltic market a localized query and filter", () => {
  const input = request();
  input.segment.geography = {
    ...input.segment.geography,
    mode: "multi_country",
    displayName: "Baltics",
    countryCodes: ["EE", "LV", "LT"],
    // Older frozen strategies omitted local languages; country codes remain authoritative.
    localLanguages: [],
    workingLanguages: ["English"],
  };
  input.budget.maxCalls = 6;

  const queries = generateWebDiscoveryQueries(input);
  assert.deepEqual([...new Set(queries.map(({ country }) => country))].sort(), [
    "EE",
    "LT",
    "LV",
  ]);
  assert.ok(queries.some(({ query }) => query.includes("Estonia")));
  assert.ok(queries.some(({ query }) => query.includes("Latvia")));
  assert.ok(queries.some(({ query }) => query.includes("Lithuania")));
  assert.deepEqual(
    queries
      .filter(({ family }) => family === "local_language")
      .map(({ language }) => language),
    ["Estonian", "Latvian", "Lithuanian"],
  );
});

test("WebSearchProvider is available only through the configured registry", () => {
  const registry = createConfiguredDiscoveryProviderRegistry();
  assert.equal(registry.get("web_search").version, "2.5");
  assert.deepEqual(
    registry.list().map(({ id }) => id),
    ["web_search"],
  );
});

test("completed equivalent queries are skipped by fingerprint", () => {
  const input = request();
  const first = generateWebDiscoveryQueries(input)[0]!;
  input.executionContext.previousQueryFingerprints = [first.fingerprint];
  assert.ok(
    generateWebDiscoveryQueries(input).every(
      ({ fingerprint }) => fingerprint !== first.fingerprint,
    ),
  );
});

test("targeted gap actions produce bounded non-duplicate frozen queries", () => {
  const input = request();
  const initial = generateWebDiscoveryQueries(input);
  input.executionContext = {
    passNumber: 2,
    gapId: "segment-1:source_diversity_low",
    previousExecutionIds: ["execution-1"],
    excludedCanonicalKeys: ["domain:acme.example"],
    previousQueryFingerprints: initial.map(({ fingerprint }) => fingerprint),
    targetedActions: [
      {
        gapId: "segment-1:source_diversity_low",
        type: "expand_directory",
        reason: "A second source family is needed.",
        expectedImprovement: "Increase source diversity.",
        maxCalls: 2,
      },
    ],
  };
  input.budget.maxCalls = 2;

  const targeted = generateWebDiscoveryQueries(input);
  assert.equal(targeted.length, 2);
  assert.ok(
    targeted.every(
      ({ expectedGapId }) => expectedGapId === "segment-1:source_diversity_low",
    ),
  );
  assert.ok(targeted.every(({ family }) => family === "directory"));
  for (const query of targeted) {
    assert.deepEqual(query.excludedDomains, ["acme.example"]);
  }
  assert.ok(
    targeted.every(
      ({ fingerprint }) => !initial.some((query) => query.fingerprint === fingerprint),
    ),
  );
});

test("targeted requests require a frozen gap action", () => {
  const input = request();
  input.executionContext.passNumber = 2;
  assert.throws(() => generateWebDiscoveryQueries(input));
});

test("WebSearchProvider executes a frozen query plan without regenerating it", async () => {
  const calls: string[] = [];
  const provider = new WebSearchProvider(async (query) => {
    calls.push(query);
    return [];
  });
  const input = request();
  const frozen = generateWebDiscoveryQueries(input).slice(1, 2);
  await provider.search(input, { queries: frozen });
  assert.deepEqual(calls, [frozen[0]!.query]);
});

test("WebSearchProvider sends the frozen country boost to Tavily", async () => {
  const calls: Array<{ query: string; country?: string }> = [];
  const provider = new WebSearchProvider(async (query, _maxResults, options) => {
    calls.push({ query, country: options?.country });
    return [];
  });
  const input = request();
  input.budget.maxCalls = 1;
  await provider.search(input);
  assert.equal(calls[0]?.country, "lithuania");
});

test("WebSearchProvider sends frozen excluded domains to Tavily", async () => {
  const calls: Array<{ excludeDomains?: string[] }> = [];
  const provider = new WebSearchProvider(async (_query, _maxResults, options) => {
    calls.push({ excludeDomains: options?.excludeDomains });
    return [];
  });
  const input = request();
  input.executionContext.excludedCanonicalKeys = [
    "domain:acme.example",
    "https://www.previous.example/path",
    "organization:not-a-domain",
  ];
  input.budget.maxCalls = 1;
  await provider.search(input);
  assert.deepEqual(calls[0]?.excludeDomains, ["acme.example", "previous.example"]);
});

test("source-family searches request extractable page content", async () => {
  const calls: Array<{ includeRawContent?: boolean }> = [];
  const provider = new WebSearchProvider(async (_query, _maxResults, options) => {
    calls.push(options ?? {});
    return [];
  });
  const input = request();
  const queries = generateWebDiscoveryQueries(input);
  const sourceQuery = queries.find(
    ({ sourceFamily }) => sourceFamily !== "company_website",
  );
  assert.ok(sourceQuery);
  await provider.search(input, { queries: [sourceQuery] });
  assert.equal(calls[0]?.includeRawContent, true);
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
  assert.equal(response.exhausted, false);
  assert.ok(response.records.every(({ rawPayloadHash }) => rawPayloadHash.length === 64));
  assert.ok(
    response.records.some(({ sourceType }) => sourceType === "industry_directory"),
  );
  assert.equal(response.normalizedCandidates.length, 2);
  assert.equal(response.classifications.length, response.records.length);
  assert.ok(
    response.classifications.every(({ disposition }) =>
      ["needs_review", "source_only"].includes(disposition),
    ),
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
  assert.equal(response.exhausted, true);
});

test("association sources produce organization references without becoming targets", async () => {
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "Trade association members directory",
        url: "https://association.example/members",
        content: [
          "[Acme Manufacturing](https://acme.example/)",
          "[Beta Logistics](https://beta.example/)",
          "- Gamma Services",
        ].join("\n"),
        score: 0.9,
      },
    ],
    () => "2026-08-13T10:00:00.000Z",
    () => "execution-source-expansion",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);
  assert.equal(response.records.length, 1);
  assert.equal(response.classifications[0]?.disposition, "source_only");
  assert.deepEqual(
    response.normalizedCandidates.map(({ name }) => name),
    ["Acme Manufacturing", "Beta Logistics", "Gamma Services"],
  );
  assert.ok(
    response.normalizedCandidates.every(
      ({ discoverySource }) =>
        discoverySource?.sourceUrl === "https://association.example/members",
    ),
  );
  assert.equal(
    response.normalizedCandidates.find(({ name }) => name === "Gamma Services")
      ?.canonicalDomainHint,
    undefined,
  );
});

test("editorial pages are evidence, not company candidates", async () => {
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "The effect of vertical integration on supply chain resilience",
        url: "https://publisher.example/insights/vertical-integration",
        content: "An industry article discussing several businesses.",
        score: 0.9,
      },
      {
        title: "Top 20 API manufacturers in the USA",
        url: "https://directory.example/articles/top-api-manufacturers",
        content: "A ranked editorial list.",
        score: 0.8,
      },
    ],
    () => "2026-07-28T10:00:00.000Z",
    () => "execution-editorial",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);

  assert.equal(response.records.length, 2);
  assert.equal(response.normalizedCandidates.length, 0);
  assert.ok(
    response.records.every((record) =>
      ["content_page", "directory_list"].includes(
        String((record.rawPayload as Record<string, unknown>).pageType),
      ),
    ),
  );
});

test("editorial publications, member lists, and sourcing platforms are not companies", () => {
  assert.equal(
    classifyWebResult({
      title: "FDA proposed rule | Pharma Manufacturing",
      url: "https://www.pharmamanufacturing.com/quality-risk/supply-chain/article/example",
      content: "Editorial coverage of an FDA proposal.",
      score: 0.8,
    }),
    "content_page",
  );
  assert.equal(
    classifyWebResult({
      title: "ABPI Members list | Membership",
      url: "https://www.abpi.org.uk/membership2/abpi-members-list",
      content: "Association membership list.",
      score: 0.8,
    }),
    "association_member_list",
  );
  assert.equal(
    classifyWebResult({
      title: "Global API Suppliers & CDMO Sourcing Platform",
      url: "https://pharma-market.example/",
      content: "A sourcing platform for buyers and suppliers.",
      score: 0.8,
    }),
    "marketplace_listing",
  );
});

test("content pages with an explicit host brand normalize to the host company", async () => {
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "Vertical Integration – Camber Pharmaceuticals",
        url: "https://www.camberpharma.com/vertical-integration",
        content: "Camber Pharmaceuticals operates an integrated supply chain.",
        score: 0.9,
      },
      {
        title: "The APIs supply chain: A case study | Hovione",
        url: "https://www.hovione.com/press-room/press-release/apis-supply-chain-case-study",
        content: "A case study published by Hovione.",
        score: 0.8,
      },
      {
        title: "The effect of vertical integration on supply chain resilience",
        url: "http://arno.uvt.nl/show.cgi?fid=162418",
        content: "An academic paper.",
        score: 0.7,
      },
    ],
    () => "2026-07-30T10:00:00.000Z",
    () => "execution-host-brand",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);

  assert.deepEqual(
    response.normalizedCandidates.map(({ name, websiteUrl }) => ({
      name,
      websiteUrl,
    })),
    [
      {
        name: "Camber Pharmaceuticals",
        websiteUrl: "https://www.camberpharma.com/",
      },
      {
        name: "Hovione",
        websiteUrl: "https://www.hovione.com/",
      },
    ],
  );
});

test("commercial pages are preclassified before becoming organization candidates", async () => {
  const provider = new WebSearchProvider(
    async () => [
      {
        title: "About Us | Acme Pharma",
        url: "https://www.acme-pharma.example/about-us",
        content: "Acme Pharma manufactures active pharmaceutical ingredients.",
        score: 0.9,
      },
      {
        title: "API integration services",
        url: "https://consultancy.example/services/api-integration",
        content: "Provides API integration services.",
        score: 0.7,
      },
    ],
    () => "2026-07-28T10:00:00.000Z",
    () => "execution-company",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);

  assert.equal(response.normalizedCandidates.length, 2);
  assert.equal(response.normalizedCandidates[0]?.name, "Acme Pharma");
  assert.equal(
    response.normalizedCandidates[0]?.websiteUrl,
    "https://www.acme-pharma.example/",
  );
  assert.equal(response.classifications[0]?.disposition, "needs_review");
  assert.equal(response.classifications[0]?.objectiveCompatibility, "incompatible");
  assert.ok(
    response.classifications[0]?.reasonCodes.includes(
      "commercial_role_requires_verification",
    ),
  );
  assert.equal(response.classifications[1]?.disposition, "needs_review");
  assert.equal(
    classifyWebResult({
      title: "Acme Pharma",
      url: "https://acme-pharma.example/en",
      content: "",
      score: 0.8,
    }),
    "company_homepage",
  );
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
  assert.equal(
    response.errors[0]?.recordReference,
    generateWebDiscoveryQueries(input)[0]?.fingerprint,
  );
  assert.equal(response.records.length, 0);
  assert.equal(response.exhausted, false);
});

test("Tavily plan-limit failures are non-retryable provider failures", async () => {
  const provider = new WebSearchProvider(
    async () => {
      throw new Error("Tavily search failed: plan usage limit exceeded (status 432).");
    },
    () => "2026-07-30T10:00:00.000Z",
    () => "execution-plan-limit",
  );
  const input = request();
  input.budget = { maxCalls: 1, maxResults: 5 };
  const response = await provider.search(input);

  assert.equal(response.errors[0]?.code, "provider_failure");
  assert.equal(response.errors[0]?.retryable, false);
  assert.match(response.errors[0]?.message ?? "", /plan usage limit exceeded/);
});

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
    budget: { maxCalls: 6, maxResults: 25 },
  };
}
