import assert from "node:assert/strict";
import test from "node:test";
import { resolveCampaignTaskId } from "./workflow-routing.ts";

test("persisted V1 Campaign Runs continue using the existing Trigger workflow", () => {
  assert.equal(resolveCampaignTaskId("v1"), "execute-campaign");
});

test("persisted V2 Campaign Runs use the canonical V2 Trigger workflow", () => {
  assert.equal(resolveCampaignTaskId("v2"), "execute-campaign-v2");
});
