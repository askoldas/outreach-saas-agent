import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync("src/server/workflow-v2/control-service.ts", "utf8");
const actions = readFileSync("src/server/campaigns/actions.ts", "utf8");
const creditRepository = readFileSync("src/server/credits/repository.ts", "utf8");
const campaignControls = readFileSync(
  "src/features/campaigns/CampaignControls.tsx",
  "utf8",
);
const checkpoint = readFileSync("src/server/company-research/checkpoint.ts", "utf8");

test("normal campaign resume never purchases an arbitrary research-credit increment", () => {
  assert.doesNotMatch(controls, /authorizeAdditionalResearchCredits|additionalCredits/);
  assert.doesNotMatch(actions, /additionalCredits/);
  assert.doesNotMatch(creditRepository, /authorizeAdditionalResearchCredits/);
});

test("completed research cannot start a replacement run from the campaign controls", () => {
  assert.match(campaignControls, /currentStatus !== "planning"/);
  assert.doesNotMatch(campaignControls, /Continue Research/);
  assert.match(actions, /campaign\.status !== "planning"/);
  assert.match(actions, /Increase the company target from Company Research/);
});

test("an internal authorization guard is not presented as a customer budget pause", () => {
  assert.doesNotMatch(checkpoint, /"paused_budget"/);
  assert.match(checkpoint, /"internal_guard"/);
});
