import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignStrategyVersion } from "@/types/domain";
import { compileCampaignCommercialContext } from "./context-compiler.ts";
import { compileCampaignStrategyV2 } from "./strategy-compiler.ts";
import { adaptV1StrategyToV2Draft } from "./v1-adapter.ts";

test("context compiler freezes only selected offering knowledge and applicable rules", () => {
  const source = contextSource();
  const compiled = compileCampaignCommercialContext(source);
  assert.deepEqual(compiled.offeringVersionIds, ["offering-version-1"]);
  assert.equal(compiled.offeringSummary, "Selected offering");
  assert.deepEqual(
    compiled.applicableProfileRules.map((rule) => rule.ruleKey),
    ["local-presence"],
  );
  assert.equal(compiled.applicableOfferingRules.length, 0);
  assert.equal(compiled.contextHash.length, 64);
  assert.ok(!JSON.stringify(compiled).includes("Unselected offering"));
});

test("context hash is deterministic across source ordering", () => {
  const source = contextSource();
  const first = compileCampaignCommercialContext(source);
  const second = compileCampaignCommercialContext({
    ...source,
    companyRoles: [...source.companyRoles].reverse(),
    rules: [...source.rules].reverse(),
    claims: [...source.claims].reverse(),
  });
  assert.equal(first.contextHash, second.contextHash);
});

test("context compiler rejects offering references outside the frozen profile", () => {
  const source = contextSource();
  assert.throws(() =>
    compileCampaignCommercialContext({
      ...source,
      offeringReferences: [
        { ...source.offeringReferences[0]!, companyProfileVersionId: "other-profile" },
      ],
    }),
  );
});

test("strategy compiler validates and canonically orders a review draft", () => {
  const draft = provisionalDraft();
  draft.archetypes.push({
    ...structuredClone(draft.archetypes[0]!),
    id: "a-archetype",
    strategyVersionId: draft.id,
    label: "Earlier archetype",
  });
  const compilation = compileCampaignStrategyV2({
    draft,
    compiledContextHash: "a".repeat(64),
  });
  assert.equal(compilation.strategy.status, "review");
  assert.equal(compilation.strategy.archetypes[0]?.id, "a-archetype");
  assert.equal(compilation.contentHash.length, 64);
  assert.equal(
    compilation.normalizedRecords.qualificationPolicy.factorDefinitions.length,
    3,
  );
});

test("strategy compiler cannot publish a confirmed strategy", () => {
  const draft = provisionalDraft();
  delete draft.legacyImport;
  draft.status = "confirmed";
  draft.objective.userConfirmed = true;
  draft.geography.userConfirmed = true;
  draft.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-28T10:00:00.000Z",
  };
  assert.throws(() =>
    compileCampaignStrategyV2({ draft, compiledContextHash: "b".repeat(64) }),
  );
});

function contextSource() {
  return {
    workspaceId: "workspace-1",
    profileVersionId: "profile-version-1",
    offeringReferences: [
      {
        companyProfileVersionId: "profile-version-1",
        offeringId: "offering-1",
        offeringVersionId: "offering-version-1",
      },
    ],
    objective: provisionalDraft().objective,
    geography: provisionalDraft().geography,
    companyRoles: ["manufacturer", "manufacturer"],
    offerings: [
      {
        offeringVersionId: "offering-version-1",
        summary: "Selected offering",
        valueDelivered: ["Lower operating cost"],
        transactionModels: ["subscription"],
        buyerUseModes: ["use"],
      },
      {
        offeringVersionId: "offering-version-2",
        summary: "Unselected offering",
        valueDelivered: [],
        transactionModels: [],
        buyerUseModes: [],
      },
    ],
    buyerHypotheses: [
      {
        offeringVersionId: "offering-version-1",
        relationshipType: "direct_buyer",
        summary: "Industrial operator",
      },
    ],
    rules: [
      {
        ruleKey: "wrong-market",
        label: "Wrong market",
        description: "Only applies elsewhere",
        ruleType: "requirement" as const,
        scope: "workspace" as const,
        strength: "hard" as const,
        applicability: {
          objectives: [],
          offeringIds: [],
          geographies: ["LV"],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "confirmed" as const,
        source: "user" as const,
        evidenceIds: [],
        confidence: 1,
      },
      {
        ruleKey: "local-presence",
        label: "Local presence",
        description: "Requires local presence",
        ruleType: "requirement" as const,
        scope: "workspace" as const,
        strength: "hard" as const,
        applicability: {
          objectives: ["direct_buyer"],
          offeringIds: [],
          geographies: ["LT"],
          relationshipTypes: ["direct_buyer"],
          archetypeIds: [],
        },
        status: "confirmed" as const,
        source: "user" as const,
        evidenceIds: [],
        confidence: 1,
      },
    ],
    claims: [
      {
        claimId: "unknown-1",
        fieldPath: "company.buyer.minimum_volume",
        statement: "Minimum volume is unknown",
        epistemicStatus: "unknown" as const,
        confidence: 0,
        evidenceIds: [],
        counterEvidenceIds: [],
      },
    ],
  };
}

function provisionalDraft() {
  return adaptV1StrategyToV2Draft({
    campaignId: "campaign-1",
    strategyDraftId: "strategy-draft-1",
    companyProfileVersionId: "profile-version-1",
    offeringId: "offering-1",
    offeringVersionId: "offering-version-1",
    memorySnapshotId: "memory-snapshot-1",
    geography: {
      displayName: "Lithuania",
      countryCodes: ["LT"],
      workingLanguages: ["English"],
    },
    strategy: legacyStrategy(),
  });
}

function legacyStrategy(): CampaignStrategyVersion {
  return {
    id: "legacy-1",
    version: 1,
    status: "ready",
    targetGeography: "Lithuania",
    companyTypes: ["Manufacturer"],
    industries: ["Industrial"],
    characteristics: ["Local operations"],
    relevanceReasons: ["May buy"],
    opportunityAssumptions: [],
    qualificationCriteria: ["Has operations"],
    positiveSignals: ["Production site"],
    exclusions: [],
    contactRoles: [],
    contactDepartments: [],
    acceptableContactRoutes: [],
    searchLanguages: ["English"],
    sourceCategories: ["website"],
    searchTerms: [],
    localizedTerms: [],
    limitations: [],
    targetCompanyCount: 25,
    refinementSummary: ["Industrial buyers"],
  };
}
