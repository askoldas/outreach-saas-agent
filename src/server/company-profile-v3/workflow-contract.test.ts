import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parent = readFileSync("src/trigger/create-company-intelligence-v3.ts", "utf8");
const child = readFileSync("src/trigger/run-company-profile-v3-stage.ts", "utf8");
const service = readFileSync("src/server/company-profile-v3/stage-service.ts", "utf8");
const repository = readFileSync("src/server/company-profile-v3/repository.ts", "utf8");

test("V3 profile orchestration uses durable sequential child stages", () => {
  assert.match(parent, /id: "create-company-intelligence-v3"/);
  assert.match(parent, /profileV3StageIds/);
  assert.match(parent, /runCompanyProfileV3StageTask\.triggerAndWait/);
  assert.match(parent, /if \(!child\.ok\)/);
  assert.match(parent, /onFailure/);
  assert.match(parent, /failProfileV3Draft/);
  assert.match(child, /id: "run-company-profile-v3-stage"/);
});

test("stage execution freezes versions, reuses completed outputs, and audits AI", () => {
  assert.match(service, /\.eq\("idempotency_key", idempotencyKey\)/);
  assert.match(service, /existing\?\.status === "completed"/);
  assert.match(service, /definition\.outputSchema\.parse/);
  assert.match(service, /\.from\("ai_requests"\)/);
  assert.match(service, /contextCompilerVersion/);
  assert.match(service, /promptContentHash/);
  assert.match(service, /\.from\("evidence_items"\)/);
  assert.match(service, /compileProfileV3Draft/);
  assert.match(service, /compile_company_profile_v3_draft/);
});

test("V3 dispatch is guarded by environment and workspace rollout", () => {
  assert.match(repository, /getWorkspaceIntelligenceSettings/);
  assert.match(repository, /settings\.profileVersion !== "v2"/);
  assert.match(repository, /create_company_profile_v3_draft/);
  assert.match(repository, /create-company-intelligence-v3/);
  assert.match(service, /resolveWorkspaceIntelligenceSettings/);
});
