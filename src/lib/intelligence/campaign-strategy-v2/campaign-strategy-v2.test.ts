import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignStrategyVersion } from "@/types/domain";
import { campaignStrategyV2Schema } from "./schemas.ts";
import { adaptV1StrategyToV2Draft } from "./v1-adapter.ts";

test("V1 adapter produces only a provisional review-required V2 strategy", () => {
  const draft = adapted();
  assert.equal(draft.schemaVersion, 2);
  assert.equal(draft.status, "review");
  assert.equal(draft.objective.userConfirmed, false);
  assert.equal(draft.geography.userConfirmed, false);
  assert.equal(draft.legacyImport?.requiresUserReview, true);
  assert.equal(draft.campaignRules[0]?.scope, "campaign");
  assert.equal(draft.campaignRules[0]?.strength, "soft");
  assert.equal(draft.discoverySegments[0]?.archetypeId, draft.archetypes[0]?.id);
  assert.ok(
    !JSON.stringify(draft.discoverySegments).includes("legacy raw query"),
    "legacy provider queries must not leak into semantic segments",
  );
});

test("confirmed V2 strategies require explicit human confirmation", () => {
  const draft = adapted();
  assert.throws(() => campaignStrategyV2Schema.parse({ ...draft, status: "confirmed" }));

  const confirmed = structuredClone(draft);
  delete confirmed.legacyImport;
  confirmed.status = "confirmed";
  confirmed.objective.userConfirmed = true;
  confirmed.geography.userConfirmed = true;
  confirmed.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-28T10:00:00.000Z",
  };
  assert.equal(campaignStrategyV2Schema.parse(confirmed).status, "confirmed");
});

test("semantic discovery segments reject provider queries and unknown archetypes", () => {
  const draft = adapted();
  const segment = draft.discoverySegments[0]!;
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      discoverySegments: [{ ...segment, queries: ["site:example.com buyers"] }],
    }),
  );
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      discoverySegments: [{ ...segment, archetypeId: "unknown-archetype" }],
    }),
  );
});

test("qualification policy requires deterministic factor weights and hard gates", () => {
  const draft = adapted();
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      qualificationPolicy: {
        ...draft.qualificationPolicy,
        factorDefinitions: draft.qualificationPolicy.factorDefinitions.map((factor) => ({
          ...factor,
          weight: 1,
        })),
      },
    }),
  );
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      qualificationPolicy: {
        ...draft.qualificationPolicy,
        hardExclusionRules: draft.campaignRules,
      },
    }),
  );
});

test("frozen offering references cannot cross profile versions", () => {
  const draft = adapted();
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      offeringReferences: [
        { ...draft.offeringReferences[0], companyProfileVersionId: "other-profile" },
      ],
    }),
  );
});

function adapted() {
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
      workingLanguages: ["English", "Lithuanian"],
    },
    strategy: legacyStrategy(),
  });
}

function legacyStrategy(): CampaignStrategyVersion {
  return {
    id: "legacy-strategy-1",
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
    searchLanguages: ["English", "Lithuanian"],
    sourceCategories: ["company_website"],
    searchTerms: ["legacy raw query"],
    localizedTerms: [],
    limitations: [],
    targetCompanyCount: 25,
    refinementSummary: ["Target industrial operators."],
  };
}
