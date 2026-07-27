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

test("Company Profile routes V3 review only through the persisted rollout setting", () => {
  assert.match(page, /getWorkspaceIntelligenceSettings/);
  assert.match(page, /profileVersion === "v2"/);
  assert.match(page, /CompanyProfileV3Workspace/);
  assert.match(page, /CompanyProfileWorkspace profile=\{profile\}/);
});

test("V3 review exposes commercial mechanics, buyer logic, rules, and questions", () => {
  assert.match(workspace, /Business model/);
  assert.match(workspace, /Offerings and buyer logic/);
  assert.match(workspace, /Buyer archetypes/);
  assert.match(workspace, /Commercial rules/);
  assert.match(workspace, /Clarification questions/);
  assert.match(workspace, /blocking clarification/);
  assert.match(workspace, /Publish V3 profile/);
  assert.match(workspace, /reviewCompanyProfileV3OfferingAction/);
  assert.match(workspace, /reviewCompanyProfileV3ArchetypeAction/);
  assert.match(workspace, /reviewCompanyProfileV3RuleAction/);
});

test("V3 review reads and mutates only workspace-scoped draft records", () => {
  assert.match(repository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(repository, /current_v3_draft_id/);
  assert.match(actions, /\.eq\("workspace_id", currentWorkspace\.id\)/);
  assert.match(actions, /\.eq\("skip_allowed", true\)/);
  assert.match(actions, /\.eq\("status", "pending"\)/);
  assert.match(actions, /publish_company_profile_v3_draft/);
  assert.match(actions, /profile_change_events/);
});
