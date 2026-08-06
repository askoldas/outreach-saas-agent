import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const campaignActionsUrl = new URL("./actions.ts", import.meta.url);
const v2ActionsUrl = new URL("../campaign-strategy-v2/actions.ts", import.meta.url);
const legacyWorkspaceUrl = new URL(
  "../../features/campaigns/StrategyWorkspace.tsx",
  import.meta.url,
);

test("new strategy confirmation is V2-native and historical strategy is read-only", async () => {
  const [campaignActions, v2Actions, legacyWorkspace] = await Promise.all([
    readFile(campaignActionsUrl, "utf8"),
    readFile(v2ActionsUrl, "utf8"),
    readFile(legacyWorkspaceUrl, "utf8"),
  ]);
  assert.match(v2Actions, /confirmCampaignStrategyV2/);
  assert.match(legacyWorkspace, /V1 read-only/);
  assert.doesNotMatch(legacyWorkspace, /saveCampaignStrategyAction/);
  assert.doesNotMatch(legacyWorkspace, /generateCampaignStrategyAction/);
  assert.match(campaignActions, /already has an active discovery run/);
  assert.match(campaignActions, /has a paused run/);
});
