import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const campaign = readFileSync(
  new URL("../campaigns/CampaignBriefForm.tsx", import.meta.url),
  "utf8",
);
const company = readFileSync(
  new URL("../company-profile/CompanyGuidedSetup.tsx", import.meta.url),
  "utf8",
);
const drawer = readFileSync(new URL("./ContextualAiDrawer.tsx", import.meta.url), "utf8");
const discoverPage = readFileSync(
  new URL("../../app/(app)/campaigns/[id]/leads/page.tsx", import.meta.url),
  "utf8",
);
const campaignControls = readFileSync(
  new URL("../campaigns/CampaignControls.tsx", import.meta.url),
  "utf8",
);

test("Company setup is decision-led while direct editing remains available", () => {
  assert.match(company, /activeQuestion/);
  assert.match(company, /Other or explain it in your own words/);
  assert.match(company, /Dismiss suggestion/);
  assert.match(company, /Publish Company Profile/);
});

test("Campaign setup starts from an offering and keeps a live structured summary", () => {
  assert.match(campaign, /Which offering should this campaign promote/);
  assert.match(campaign, /What commercial relationship are you seeking/);
  assert.match(campaign, /Which markets should this campaign target/);
  assert.match(campaign, /saveAsOfferingDefaults/);
  assert.match(campaign, /GuidedStatus/);
  assert.match(campaign, /offeringOverrides/);
  assert.match(campaign, /interpretCampaignDraftRequestAction/);
  assert.match(campaign, /Apply changes/);
});

test("contextual AI is scoped and cannot silently apply proposals", () => {
  assert.match(drawer, /Ask Opptium about/);
  assert.match(drawer, /applyGuidedProposalAction/);
  assert.match(drawer, /baseVersion/);
  assert.match(drawer, /Suggestions are not saved until/);
});

test("new campaigns can be started from the Discover page", () => {
  assert.match(discoverPage, /CampaignControls/);
  assert.match(campaignControls, /Start campaign and discover leads/);
});
