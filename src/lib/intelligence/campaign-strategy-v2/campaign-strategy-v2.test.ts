import assert from "node:assert/strict";
import test from "node:test";
import { campaignStrategyV2Schema } from "./schemas.ts";
import { createNativeCampaignStrategyFixture } from "./test-fixture.ts";

test("native creation produces a provisional review strategy without compatibility data", () => {
  const draft = createNativeCampaignStrategyFixture();
  assert.equal(draft.schemaVersion, 2);
  assert.equal(draft.creationContract, "native-campaign-strategy/v1");
  assert.equal(draft.status, "review");
  assert.equal(draft.legacyImport, undefined);
  assert.equal(draft.objective.userConfirmed, true);
  assert.equal(draft.geography.userConfirmed, true);
  assert.equal(draft.discoverySegments[0]?.archetypeId, draft.archetypes[0]?.id);
});

test("confirmed V2 strategies require explicit human confirmation", () => {
  const draft = createNativeCampaignStrategyFixture();
  assert.throws(() => campaignStrategyV2Schema.parse({ ...draft, status: "confirmed" }));

  const confirmed = structuredClone(draft);
  confirmed.status = "confirmed";
  confirmed.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-28T10:00:00.000Z",
  };
  assert.equal(campaignStrategyV2Schema.parse(confirmed).status, "confirmed");
});

test("confirmed V2 strategies accept PostgreSQL ISO timestamps with an offset", () => {
  const confirmed = createNativeCampaignStrategyFixture();
  confirmed.status = "confirmed";
  confirmed.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-29T08:15:30.123+00:00",
  };

  assert.equal(
    campaignStrategyV2Schema.parse(confirmed).userConfirmation.confirmedAt,
    "2026-07-29T08:15:30.123+00:00",
  );
});

test("semantic discovery segments reject provider queries and unknown archetypes", () => {
  const draft = createNativeCampaignStrategyFixture();
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
  const draft = createNativeCampaignStrategyFixture();
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
  const draft = createNativeCampaignStrategyFixture();
  assert.throws(() =>
    campaignStrategyV2Schema.parse({
      ...draft,
      offeringReferences: [
        { ...draft.offeringReferences[0], companyProfileVersionId: "other-profile" },
      ],
    }),
  );
});
