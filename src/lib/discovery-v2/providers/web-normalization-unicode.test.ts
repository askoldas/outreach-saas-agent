import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../../intelligence/campaign-strategy-v2/test-fixture.ts";
import { normalizeWebSearchResult } from "./web-normalization.ts";

test("web normalization removes PostgreSQL-forbidden NUL characters before hashing", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const segment = strategy.discoverySegments[0]!;
  const normalized = normalizeWebSearchResult({
    result: {
      title: "Example\u0000 Company",
      url: "https://example.com/",
      content: "Commercial\u0000 evidence",
      score: 0.8,
    },
    query: {
      id: "query-1",
      campaignId: "campaign-1",
      discoverySegmentId: segment.id,
      query: "example company",
      normalizedQuery: "example company",
      family: "direct_commercial",
      sourceFamily: "company_website",
      language: "en",
      purpose: "Find target organizations",
      fingerprint: "a".repeat(64),
      priority: 1,
      status: "planned",
    },
    rank: 1,
    providerVersion: "2.5",
    retrievedAt: "2026-08-24T00:00:00.000Z",
    segment,
  });

  const serialized = JSON.stringify(normalized.record.rawPayload);
  assert.doesNotMatch(serialized, /\\u0000/i);
  assert.equal(
    normalized.record.rawPayloadHash,
    createHash("sha256").update(serialized).digest("hex"),
  );
});
