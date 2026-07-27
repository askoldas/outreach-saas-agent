import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(
  new URL("../../features/campaigns/CampaignBriefForm.tsx", import.meta.url),
  "utf8",
);
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const contracts = readFileSync(
  new URL("../../lib/campaign-workflow/contracts.ts", import.meta.url),
  "utf8",
);

test("Campaign creation stores exactly one primary Company Profile offering", () => {
  assert.match(form, /type="radio"/);
  assert.match(form, /name="primaryOffering"/);
  assert.match(form, /value=\{selectedOfferingId\}/);
  assert.doesNotMatch(form, /type="checkbox"/);
  assert.match(contracts, /profileOfferingIds\.length !== 1/);
  assert.match(actions, /selectedOfferingId/);
  assert.match(repository, /selectedOfferingId: input\.selectedOfferingId/);
});

test("Campaign targeting remains campaign-owned and cannot mutate the profile", () => {
  for (const field of [
    "targetSegments",
    "industryTerms",
    "qualificationCriteria",
    "exclusions",
    "preferredOutreachLanguage",
  ])
    assert.match(actions, new RegExp(field));
  assert.match(form, /This does not change the Company Profile/);
  assert.match(form, /never change the Company\s+Profile/);
  assert.doesNotMatch(actions, /saveCompanyProfile|saveCompanyProfileVersion/);
  assert.doesNotMatch(repository, /\.from\("company_profile_versions"\)\.update/);
});
