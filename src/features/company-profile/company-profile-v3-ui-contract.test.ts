import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/(app)/company-profile/page.tsx", "utf8");
const workspace = readFileSync(
  "src/features/company-profile/CompanyProfileV3Workspace.tsx",
  "utf8",
);
const actions = readFileSync("src/server/company-profile-v3/actions.ts", "utf8");
const repository = readFileSync("src/server/company-profile-v3/repository.ts", "utf8");

test("Company Profile uses the canonical native V3 review path", () => {
  assert.match(page, /CompanyProfileV3Workspace/);
  assert.match(page, /const reviewable/);
  assert.doesNotMatch(page, /getWorkspaceIntelligenceSettings/);
  assert.doesNotMatch(page, /CompanyProfileWorkspace/);
  assert.match(page, /Create Company Intelligence/);
  assert.match(page, /Improve Company Intelligence/);
  assert.match(page, /website=\{currentWorkspace\.websiteUrl\}/);
});

test("V3 review exposes commercial mechanics, buyer logic, rules, and questions", () => {
  assert.match(workspace, /Business model/);
  assert.match(workspace, /Offerings and buyer logic/);
  assert.match(workspace, /Buyer archetypes/);
  assert.match(workspace, /Commercial rules/);
  assert.match(workspace, /Clarification questions/);
  assert.match(workspace, /optional clarification/);
  assert.match(workspace, /Answer only what is useful/);
  assert.match(workspace, /"high impact"/);
  assert.match(workspace, /Publish V3 profile/);
  assert.match(workspace, /reviewCompanyProfileV3OfferingAction/);
  assert.match(workspace, /reviewCompanyProfileV3ArchetypeAction/);
  assert.match(workspace, /reviewCompanyProfileV3RuleAction/);
  assert.match(workspace, /updateCompanyProfileV3CoreAction/);
  assert.match(workspace, /Save reviewed core/);
  assert.match(workspace, /required=\{question\.answer_type !== "multi_select"\}/);
  assert.match(page, /question-answer-required/);
  assert.match(page, /Choose or enter an answer/);
  assert.match(page, /v3-question-answered/);
  assert.match(page, /v3-question-skipped/);
});

test("V3 review reads and mutates only workspace-scoped draft records", () => {
  assert.match(repository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(repository, /current_v3_draft_id/);
  assert.match(actions, /\.eq\("workspace_id", currentWorkspace\.id\)/);
  assert.doesNotMatch(actions, /\.eq\("skip_allowed", true\)/);
  assert.match(actions, /\.eq\("status", "pending"\)/);
  assert.match(actions, /publish_company_profile_v3_draft/);
  assert.match(actions, /profile_change_events/);
  assert.match(actions, /update_company_profile_v3_core/);
});

test("native V3 creation does not require a legacy structured profile", () => {
  assert.match(actions, /createAndDispatchCompanyIntelligenceV3Draft/);
  assert.match(actions, /website-required/);
  assert.doesNotMatch(actions, /structured-profile-required/);
  assert.doesNotMatch(repository, /structuredProfile/);
  assert.doesNotMatch(repository, /adaptV2ProfileToV3Draft/);
});

test("native profile creation exposes actionable database and Trigger failures", () => {
  assert.match(actions, /v3-database-repair-required/);
  assert.match(actions, /v3-profile-container-missing/);
  assert.match(actions, /v3-trigger-dispatch-failed/);
  assert.match(repository, /Company Intelligence Trigger dispatch failed/);
});

test("profile publication exposes actionable prerequisite failures", () => {
  assert.match(actions, /profilePublishErrorCode/);
  assert.match(actions, /v3-publish-stale-audit-gate/);
  assert.match(actions, /v3-publish-no-active-offering/);
  assert.match(actions, /v3-publish-missing-model/);
  assert.match(actions, /v3-publish-database-update-required/);
  assert.match(actions, /"message" in error/);
  assert.match(page, /Publication is still using the stale consistency-audit gate/);
});
