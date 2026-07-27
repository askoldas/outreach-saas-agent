import assert from "node:assert/strict";
import test from "node:test";
import { resolveCampaignTaskId } from "./workflow-routing.ts";

test("persisted V1 Campaign Runs continue using the existing Trigger workflow", () => {
  assert.equal(resolveCampaignTaskId("v1"), "execute-campaign");
});

test("V2 runs fail closed until the V2 Trigger workflow package is installed", () => {
  assert.throws(() => resolveCampaignTaskId("v2"), /not enabled yet/);
});
