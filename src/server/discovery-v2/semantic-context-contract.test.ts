import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stageContext = source("src/server/discovery-v2/stage-context.ts");
const semanticContext = source("src/server/discovery-v2/semantic-context.ts");

test("semantic Memory retrieval is frozen to parsed Campaign Run identities", () => {
  assert.match(stageContext, /campaignRunContextSchema\.parse\(campaignRun\)/);
  assert.match(stageContext, /strategyVersionContextSchema\.parse\(strategyVersion\)/);
  assert.match(stageContext, /version,confirmation_status,confirmed_at,confirmed_by/);
  assert.match(stageContext, /campaignRunCreatedAt: new Date/);
  assert.match(semanticContext, /memoryRetrievalContextSchema\.parse/);
  assert.match(semanticContext, /workspaceId: context\.workspaceId/);
  assert.match(semanticContext, /userId: context\.confirmedByUserId/);
  assert.match(semanticContext, /runId: context\.campaignRunId/);
  assert.match(semanticContext, /now: context\.campaignRunCreatedAt/);
});

test("semantic Memory selection and hashing are deterministic", () => {
  assert.match(semanticContext, /\.lte\("created_at", context\.campaignRunCreatedAt\)/);
  assert.match(semanticContext, /\.lte\("updated_at", context\.campaignRunCreatedAt\)/);
  assert.match(
    semanticContext,
    /\.order\("updated_at", \{ ascending: false \}\)[\s\S]+\.order\("id", \{ ascending: true \}\)/,
  );
  assert.match(
    semanticContext,
    /offeringReferences\.map\(\(\{ offeringId \}\) => offeringId\)/,
  );
  assert.match(semanticContext, /function sortedUnique/);
  assert.match(semanticContext, /conflicts: \[\.\.\.resolved\.conflicts\]\.sort/);
  assert.match(semanticContext, /campaignMemorySnapshotPayloadSchema\.parse/);
  assert.match(semanticContext, /hashCanonical\(snapshot\)/);
});

test("Campaign Run snapshot RPC and returned identities fail closed", () => {
  assert.match(semanticContext, /load_campaign_run_memory_snapshot_v2/);
  assert.match(semanticContext, /if \(existingSnapshot\)/);
  assert.match(semanticContext, /freeze_campaign_run_memory_snapshot_v2/);
  for (const argument of [
    "target_workspace_id",
    "target_campaign_run_id",
    "target_strategy_version_id",
    "target_snapshot",
    "target_content_hash",
  ]) {
    assert.match(semanticContext, new RegExp(argument));
  }
  assert.match(semanticContext, /frozenMemorySnapshotRowSchema\.parse\(data\)/);
  assert.match(semanticContext, /row\.snapshot_json\.context\.runId/);
  assert.match(semanticContext, /hashCanonical\(row\.snapshot_json\)/);
});

test("runtime Strategy clone owns every canonical persisted identity", () => {
  assert.match(semanticContext, /id: input\.strategyVersionId/);
  assert.match(semanticContext, /campaignId: input\.campaignId/);
  assert.match(semanticContext, /versionNumber: input\.strategyVersionNumber/);
  assert.match(semanticContext, /memorySnapshotId: input\.memorySnapshotId/);
  assert.match(
    semanticContext,
    /archetypes: input\.strategy\.archetypes\.map[\s\S]+strategyVersionId: input\.strategyVersionId/,
  );
  assert.match(
    semanticContext,
    /discoverySegments: input\.strategy\.discoverySegments\.map[\s\S]+strategyVersionId: input\.strategyVersionId/,
  );
  assert.match(semanticContext, /return campaignStrategyV2Schema\.parse/);
});

test("Memory parsing and application audit are retry safe", () => {
  assert.match(semanticContext, /return intelligenceMemorySchema\.parse/);
  assert.match(semanticContext, /\.from\("memory_application_events"\)\.upsert\(events/);
  assert.match(
    semanticContext,
    /memory_snapshot_id,memory_id,applied_to_type,applied_to_id/,
  );
  assert.match(semanticContext, /ignoreDuplicates: true/);
  assert.match(semanticContext, /conflictByOverriddenMemoryId/);
});
