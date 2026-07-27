import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync("src/features/campaigns/CampaignBriefForm.tsx", "utf8");
const actions = readFileSync("src/server/campaigns/actions.ts", "utf8");
const strategyPage = readFileSync(
  "src/app/(app)/campaigns/[id]/strategy/page.tsx",
  "utf8",
);
const workspace = readFileSync(
  "src/features/campaigns/CampaignStrategyV2Workspace.tsx",
  "utf8",
);

test("V2 campaign creation is geography-first and captures an explicit objective", () => {
  assert.match(form, /Where do you want to find companies/);
  assert.match(form, /Campaign objective/);
  assert.match(form, /Find direct buyers/);
  assert.match(form, /Build campaign strategy/);
  assert.match(form, /strategyV2/);
});

test("V2 routing creates a review draft without auto-starting discovery", () => {
  assert.match(actions, /settings\.campaignWorkflow === "v2"/);
  assert.match(actions, /createInitialCampaignStrategyV2/);
  const branchStart = actions.indexOf('settings.campaignWorkflow === "v2"');
  const branch = actions.slice(
    branchStart,
    actions.indexOf("const { runId } = await enqueueCampaignDiscoveryRun", branchStart),
  );
  assert.doesNotMatch(branch, /enqueueCampaignDiscoveryRun/);
  assert.match(branch, /\/strategy\?message=/);
});

test("strategy review uses an explicit confirmation gate and keeps discovery gated", () => {
  assert.match(strategyPage, /CampaignStrategyV2Workspace/);
  assert.match(strategyPage, /campaignWorkflow === "v2"/);
  assert.match(workspace, /Confirm strategy/);
  assert.match(workspace, /confirmCampaignStrategyV2Action/);
  assert.match(workspace, /Start discovery/);
  assert.match(workspace, /disabled/);
  assert.match(workspace, /WP-11/);
});
