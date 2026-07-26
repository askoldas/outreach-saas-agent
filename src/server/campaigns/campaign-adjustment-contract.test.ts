import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const campaignActionsUrl = new URL("./actions.ts", import.meta.url);
const strategyActionsUrl = new URL("../campaign-strategy/actions.ts", import.meta.url);
const strategyWorkspaceUrl = new URL(
  "../../features/campaigns/StrategyWorkspace.tsx",
  import.meta.url,
);

test("market adjustment is versioned and cannot mutate an active run", async () => {
  const [campaignActions, strategyActions, workspace] = await Promise.all([
    readFile(campaignActionsUrl, "utf8"),
    readFile(strategyActionsUrl, "utf8"),
    readFile(strategyWorkspaceUrl, "utf8"),
  ]);
  assert.match(strategyActions, /saveCampaignStrategyVersion/);
  assert.match(strategyActions, /assertRevisionAllowed\(campaign\.status\)/);
  assert.match(strategyActions, /Pause the active campaign run before adjusting/);
  assert.match(workspace, /new immutable/);
  assert.match(workspace, /disabled=\{activeRun\}/);
  assert.match(campaignActions, /already has an active discovery run/);
  assert.match(campaignActions, /has a paused run/);
});
