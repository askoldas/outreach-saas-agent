import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync("src/features/campaigns/CampaignBriefForm.tsx", "utf8");
const actions = readFileSync("src/server/campaigns/actions.ts", "utf8");
const newCampaignPage = readFileSync("src/app/(app)/campaigns/new/page.tsx", "utf8");
const profilePage = readFileSync("src/app/(app)/company-profile/page.tsx", "utf8");
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
  assert.match(form, /CampaignPlanningProfile/);
  assert.match(form, /NativeOfferingSuggestionCard/);
});

test("native campaign creation creates a review draft without a V1 strategy or auto-start", () => {
  assert.match(actions, /createInitialCampaignStrategyV2/);
  assert.match(actions, /getPublishedCampaignPlanningProfile/);
  const createAction = actions.slice(actions.indexOf("createCampaignAction"));
  assert.doesNotMatch(createAction, /getCurrentCampaignStrategy/);
  assert.doesNotMatch(createAction, /legacyStrategy/);
  assert.doesNotMatch(createAction, /settings\.campaignWorkflow/);
  assert.match(createAction, /\/strategy\?message=/);
});

test("campaign creation explains the native Company Intelligence prerequisite", () => {
  assert.match(newCampaignPage, /company-intelligence-required/);
  assert.match(actions, /company-intelligence-required/);
  assert.match(
    profilePage,
    /Create and publish Company Intelligence before creating a campaign\./,
  );
  assert.doesNotMatch(newCampaignPage, /structured-profile-required/);
  assert.doesNotMatch(actions, /structured-profile-required/);
});

test("strategy review uses an explicit confirmation gate and routes confirmed work to campaign controls", () => {
  assert.match(strategyPage, /CampaignStrategyV2Workspace/);
  assert.match(strategyPage, /getCampaignWorkflowVersion/);
  assert.match(strategyPage, /workflowVersion === "v2"/);
  assert.match(workspace, /Confirm strategy/);
  assert.match(workspace, /confirmCampaignStrategyV2Action/);
  assert.match(workspace, /Go to campaign controls/);
  assert.doesNotMatch(workspace, /WP-11/);
});

test("incomplete native strategy drafts render a recoverable state instead of being parsed", () => {
  assert.match(strategyPage, /CampaignStrategyV2Recovery/);
  assert.match(strategyPage, /draft && !draft\.strategy/);
  assert.match(workspace, /Retry strategy setup/);
  assert.match(workspace, /retryCampaignStrategyV2Action/);
});
