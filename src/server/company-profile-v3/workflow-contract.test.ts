import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertProfileStageDependencies,
  profileV3StageDependencies,
} from "../../lib/intelligence/company-profile-v3/workflow.ts";

const parent = readFileSync("src/trigger/create-company-intelligence-v3.ts", "utf8");
const service = readFileSync("src/server/company-profile-v3/stage-service.ts", "utf8");
const sourceService = readFileSync(
  "src/server/company-profile-v3/source-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/company-profile-v3/repository.ts", "utf8");

test("V3 profile orchestration uses one retryable Trigger run with durable sequential stages", () => {
  assert.match(parent, /id: "create-company-intelligence-v3"/);
  assert.match(parent, /profileV3StageIds/);
  assert.match(parent, /executeProfileV3Stage/);
  assert.doesNotMatch(parent, /triggerAndWait/);
  assert.match(parent, /maxAttempts: 3/);
  assert.match(parent, /minTimeoutInMs: 5_000/);
  assert.match(parent, /onFailure/);
  assert.match(parent, /failProfileV3Draft/);
});

test("stage execution freezes versions, reuses completed outputs, and audits AI", () => {
  assert.match(service, /\.eq\("idempotency_key", idempotencyKey\)/);
  assert.match(service, /existing\?\.status === "completed"/);
  assert.match(service, /executeValidatedAiTask/);
  assert.match(service, /IntelligenceTaskRegistry/);
  assert.match(service, /IntelligenceSchemaRegistry/);
  assert.match(service, /createIntelligenceAttemptRecorder/);
  assert.match(service, /generateValidatedProfileStageOutput/);
  assert.match(service, /structuredOutputFallbackUsed/);
  assert.match(service, /truncationRetryUsed/);
  assert.match(service, /profileUnderAudit/);
  assert.match(service, /input\.taskId === "profile\.consistency_audit"/);
  assert.match(service, /assembleProfileUnderAudit/);
  assert.match(service, /\.from\("ai_requests"\)/);
  assert.match(service, /contextCompilerVersion/);
  assert.match(service, /promptContentHash/);
  assert.match(service, /\.from\("evidence_items"\)/);
  assert.match(service, /ensureNativeCompanyProfileEvidence/);
  assert.match(service, /assertIntelligenceExternalCallsAllowed\("model"\)/);
  assert.match(service, /compileProfileV3Draft/);
  assert.match(service, /compile_company_profile_v3_draft/);
});

test("every profile stage enforces its complete ordered dependency chain", () => {
  assert.deepEqual(profileV3StageDependencies["profile.consistency_audit"], [
    "profile.fact_extraction",
    "profile.commercial_synthesis",
    "profile.offering_decomposition",
    "profile.buyer_logic",
    "profile.clarification",
  ]);
  assert.throws(
    () => assertProfileStageDependencies("profile.buyer_logic", [
      { taskId: "profile.fact_extraction" },
      { taskId: "profile.commercial_synthesis" },
    ]),
    /profile\.offering_decomposition/,
  );
  assert.doesNotThrow(() => assertProfileStageDependencies(
    "profile.buyer_logic",
    [
      { taskId: "profile.fact_extraction" },
      { taskId: "profile.commercial_synthesis" },
      { taskId: "profile.offering_decomposition" },
    ],
  ));
});

test("V3 dispatch starts from the workspace website without a V1 profile adapter", () => {
  assert.match(repository, /getWorkspaceIntelligenceSettings/);
  assert.match(repository, /settings\.profileVersion !== "v2"/);
  assert.match(repository, /createNativeCompanyProfileSeed/);
  assert.match(repository, /create_native_company_profile_v3_draft/);
  assert.match(repository, /target_input_hash: inputHash/);
  assert.doesNotMatch(repository, /adaptV2ProfileToV3Draft/);
  assert.doesNotMatch(repository, /from "@\/server\/company-profile\/repository"/);
  assert.match(repository, /create-company-intelligence-v3/);
  assert.match(service, /resolveWorkspaceIntelligenceSettings/);
});

test("native profile source collection persists bounded first-party evidence", () => {
  assert.match(sourceService, /company_profile_source_collection/);
  assert.match(sourceService, /assertIntelligenceExternalCallsAllowed\("provider"\)/);
  assert.match(sourceService, /searchWeb/);
  assert.match(sourceService, /extractWebPages/);
  assert.match(sourceService, /subject_type: "company_profile_draft"/);
  assert.match(sourceService, /provider_execution_id: execution\.id/);
  assert.match(sourceService, /maximumPages = 5/);
  assert.match(sourceService, /maximumPageLength = 8_000/);
});