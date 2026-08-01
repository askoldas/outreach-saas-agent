import assert from "node:assert/strict";
import test from "node:test";
import {
  canRetryCampaignStrategyV2Draft,
  parseCampaignStrategyV2DraftPayload,
} from "./draft-state.ts";
import { createNativeCampaignStrategyFixture } from "./test-fixture.ts";

test("uncompiled Campaign Strategy placeholders are not parsed as strategies", () => {
  assert.equal(parseCampaignStrategyV2DraftPayload("building", {}), null);
  assert.equal(canRetryCampaignStrategyV2Draft("building"), true);
});

test("compiled Campaign Strategy drafts retain strict contract validation", () => {
  assert.throws(() => parseCampaignStrategyV2DraftPayload("ready_for_review", {}));
  assert.equal(
    parseCampaignStrategyV2DraftPayload(
      "ready_for_review",
      createNativeCampaignStrategyFixture(),
    )?.schemaVersion,
    2,
  );
});
