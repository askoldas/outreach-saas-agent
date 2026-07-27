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
const suggestionCards = readFileSync(
  new URL("./SuggestionCards.tsx", import.meta.url),
  "utf8",
);
const discoverPage = readFileSync(
  new URL("../../app/(app)/campaigns/[id]/leads/page.tsx", import.meta.url),
  "utf8",
);
const campaignControls = readFileSync(
  new URL("../campaigns/CampaignControls.tsx", import.meta.url),
  "utf8",
);
const campaignAction = readFileSync(
  new URL("../../server/campaigns/actions.ts", import.meta.url),
  "utf8",
);
const guidedRepository = readFileSync(
  new URL("../../server/guided/repository.ts", import.meta.url),
  "utf8",
);

test("Company setup is decision-led while direct editing remains available", () => {
  assert.match(company, /activeQuestion/);
  assert.match(company, /Other or explain it in your own words/);
  assert.match(company, /Dismiss suggestion/);
  assert.match(company, /Publish Company Profile/);
});

test("Campaign setup starts from geography and keeps a live structured summary", () => {
  assert.match(campaign, /Where do you want to find companies/);
  assert.match(campaign, /proposeCampaignBriefAction/);
  assert.match(campaign, /Review the recommended offering/);
  assert.match(campaign, /Review the recommended target client/);
  assert.match(campaign, /Qualified companies wanted/);
  assert.match(campaign, /GuidedStatus/);
  assert.match(campaign, /offeringOverrides/);
  assert.match(campaign, /briefProposal/);
  assert.match(campaign, /confirmedBrief/);
});

test("contextual AI is scoped and cannot silently apply proposals", () => {
  assert.match(drawer, /Ask Opptium about/);
  assert.match(drawer, /applyGuidedProposalAction/);
  assert.match(drawer, /baseVersion/);
  assert.match(drawer, /Suggestions are not saved until/);
  assert.match(drawer, /selectedChangeIds/);
  assert.match(drawer, /Apply selected/);
  assert.match(drawer, /Apply all/);
  assert.match(drawer, /Cancel/);
});

test("Offering and Target suggestions use structured selectable cards", () => {
  assert.match(campaign, /OfferingSuggestionCard/);
  assert.match(campaign, /TargetSuggestionCard/);
  assert.match(suggestionCards, /View evidence and why suggested/);
  assert.match(suggestionCards, /View why suggested and discovery feasibility/);
  assert.match(suggestionCards, /Remove from Campaign/);
  assert.match(suggestionCards, /Include target/);
});

test("campaign progress remains controllable from the Discover page", () => {
  assert.match(discoverPage, /CampaignControls/);
  assert.match(campaignControls, /Start campaign and discover leads/);
});

test("successful campaign creation consumes its reusable new-campaign draft", () => {
  assert.match(campaignAction, /completeGuidedDraft\(currentWorkspace\.id/);
  assert.match(guidedRepository, /\.update\(\{ status: "applied" \}\)/);
  assert.match(guidedRepository, /\.gte\("created_at", data\.updated_at\)/);
  assert.match(guidedRepository, /\.in\("status", \["draft", "ready"\]\)/);
  assert.doesNotMatch(campaign, /Any relevant market/);
  assert.match(campaign, /disabled=\{pending \|\| !countryCodes\.length\}/);
  assert.match(campaignAction, /enqueueCampaignDiscoveryRun/);
});
