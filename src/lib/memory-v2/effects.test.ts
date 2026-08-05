import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderDiscoveryRequest } from "../discovery-v2/contracts.ts";
import { generateWebDiscoveryQueries } from "../discovery-v2/providers/web-query-generator.ts";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import type { IntelligenceMemory } from "../intelligence/contracts/memory.ts";
import { applyMemoryEntityResolutionEffects, compileMemoryEffects } from "./effects.ts";
import { resolveApplicableMemories } from "./retrieval.ts";

const now = "2026-07-27T12:00:00.000Z";

function memory(id: string, overrides: Partial<IntelligenceMemory>): IntelligenceMemory {
  return {
    id,
    workspaceId: "workspace-1",
    scope: "campaign",
    scopeId: "campaign-1",
    kind: "correction",
    statement: `Statement ${id}`,
    applicability: {},
    applicabilityStatus: "known",
    strength: "hard",
    status: "confirmed",
    source: "user",
    confidence: 0.9,
    evidenceIds: ["evidence-1"],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("hard-exclusion Memory changes Strategy, discovery, and qualification", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const exclusion = memory("exclude-software-vendors", {
    kind: "exclusion",
    effect: {
      type: "hard_exclusion",
      rule: {
        ruleKey: "exclude.software-vendors",
        label: "Exclude software vendors",
        description: "Do not qualify software vendors.",
        ruleType: "hard_exclusion",
        scope: "campaign",
        strength: "hard",
        applicability: {
          objectives: [],
          offeringIds: [],
          geographies: [],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "confirmed",
        source: "user",
        evidenceIds: ["evidence-1"],
        confidence: 0.9,
      },
    },
  });

  const compiled = compileMemoryEffects({ strategy, memories: [exclusion] });
  assert.ok(
    compiled.strategy.campaignRules.some(
      ({ ruleKey }) => ruleKey === "exclude.software-vendors",
    ),
  );
  assert.ok(
    compiled.strategy.qualificationPolicy.hardExclusionRules.some(
      ({ ruleKey }) => ruleKey === "exclude.software-vendors",
    ),
  );
  assert.ok(
    compiled.strategy.discoverySegments[0]?.exclusionRules.some(
      ({ ruleKey }) => ruleKey === "exclude.software-vendors",
    ),
  );
  assert.deepEqual(compiled.trace[0]?.changedLayers, [
    "strategy",
    "discovery",
    "qualification",
  ]);
});

test("query-term exclusion deterministically changes every frozen web query", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const baseline = queriesFor(strategy.discoverySegments[0]!);
  const compiled = compileMemoryEffects({
    strategy,
    memories: [
      memory("exclude-consultants", {
        effect: { type: "query_term_exclude", terms: ["consulting firm"] },
      }),
    ],
  });
  const changed = queriesFor(compiled.strategy.discoverySegments[0]!);

  assert.ok(changed.length > 0);
  assert.ok(changed.every(({ query }) => query.includes('-"consulting firm"')));
  assert.notDeepEqual(
    changed.map(({ fingerprint }) => fingerprint),
    baseline.map(({ fingerprint }) => fingerprint),
  );
});

test("campaign relationship correction is scoped and offering Memory does not leak", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const archetypeId = strategy.archetypes[0]!.id;
  const campaignCorrection = memory("campaign-relationship", {
    applicability: { archetypeIds: [archetypeId] },
    effect: { type: "relationship_correction", relationshipType: "distributor" },
  });
  const wrongOffering = memory("other-offering", {
    scope: "offering",
    scopeId: "offering-2",
    effect: { type: "query_term_include", terms: ["must-not-leak"] },
  });
  const context = {
    workspaceId: "workspace-1",
    userId: "user-1",
    offeringIds: ["offering-1"],
    campaignId: "campaign-1",
    geographyCodes: ["LT"],
    archetypeIds: [archetypeId],
    relationshipTypes: [strategy.archetypes[0]!.relationshipType],
    qualificationFactorKeys: [],
    objectiveCode: strategy.objective.code,
    now,
  };
  const resolved = resolveApplicableMemories(
    [campaignCorrection, wrongOffering],
    context,
  );
  const compiled = compileMemoryEffects({ strategy, memories: resolved.applied });

  assert.deepEqual(
    resolved.applied.map(({ id }) => id),
    ["campaign-relationship"],
  );
  assert.equal(compiled.strategy.archetypes[0]?.relationshipType, "distributor");
  assert.equal(compiled.strategy.discoverySegments[0]?.relationshipType, "distributor");
  assert.ok(
    !compiled.strategy.discoverySegments[0]?.businessCharacteristics.keywords.includes(
      "must-not-leak",
    ),
  );
});

test("campaign Memory overrides conflicting workspace Memory and snapshot replay is immutable", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const workspace = memory("workspace-correction", {
    scope: "workspace",
    scopeId: "workspace-1",
    source: "system",
    effect: { type: "relationship_correction", relationshipType: "reseller" },
  });
  const campaign = memory("campaign-correction", {
    source: "system",
    effect: { type: "relationship_correction", relationshipType: "distributor" },
  });
  const resolved = resolveApplicableMemories([workspace, campaign], {
    workspaceId: "workspace-1",
    offeringIds: ["offering-1"],
    campaignId: "campaign-1",
    geographyCodes: ["LT"],
    archetypeIds: [strategy.archetypes[0]!.id],
    relationshipTypes: [strategy.archetypes[0]!.relationshipType],
    qualificationFactorKeys: [],
    objectiveCode: strategy.objective.code,
    now,
  });
  const frozen = structuredClone(resolved.applied);
  campaign.effect = {
    type: "relationship_correction",
    relationshipType: "referral_partner",
  };

  assert.deepEqual(
    resolved.applied.map(({ id }) => id),
    ["campaign-correction"],
  );
  assert.equal(
    compileMemoryEffects({ strategy, memories: frozen }).strategy.archetypes[0]
      ?.relationshipType,
    "distributor",
  );
});

test("organization aliases and entity corrections alter resolution input", () => {
  const effects = compileMemoryEffects({
    strategy: createNativeCampaignStrategyFixture(),
    memories: [
      memory("alias", {
        effect: {
          type: "organization_alias",
          organizationId: "organization-1",
          canonicalName: "Acme Group",
          aliases: ["Acme UAB"],
        },
      }),
      memory("identity", {
        kind: "fact",
        effect: {
          type: "entity_resolution_correction",
          action: {
            type: "canonical_identity",
            matchNames: ["Example Ltd"],
            canonicalName: "Example Holdings",
            canonicalDomain: "example.com",
          },
        },
      }),
    ],
  }).entityResolutionEffects;
  const adjusted = applyMemoryEntityResolutionEffects(
    [
      {
        name: "Acme UAB",
        normalizedName: "acme uab",
        canonicalDomainHint: null,
      },
      {
        name: "Example Ltd",
        normalizedName: "example ltd",
        canonicalDomainHint: null,
      },
    ],
    effects,
  );

  assert.equal(adjusted[0]?.name, "Acme Group");
  assert.equal(adjusted[1]?.name, "Example Holdings");
  assert.equal(adjusted[1]?.canonicalDomainHint, "example.com");
});

function queriesFor(segment: ProviderDiscoveryRequest["segment"]) {
  return generateWebDiscoveryQueries({
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    discoveryPlanId: "plan-1",
    segment,
    executionContext: {
      passNumber: 1,
      previousExecutionIds: [],
      excludedCanonicalKeys: [],
      previousQueryFingerprints: [],
    },
    budget: { maxCalls: 6, maxResults: 25 },
  });
}
