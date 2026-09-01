import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stage = source("src/server/discovery-v2/targeted-discovery-stage.ts");
const history = source("src/server/discovery-v2/discovery-history.ts");
const repository = source("src/server/discovery-v2/coverage-repository.ts");
const generator = source("src/lib/discovery-v2/providers/web-query-generator.ts");

test("one targeted pass returns control to the adaptive Company Research cycle", () => {
  assert.match(stage, /loadLatestDiscoveryPassDecision/);
  assert.match(stage, /if \(latestDecision\.decision_json\.decision === "continue"\)/);
  assert.doesNotMatch(stage, /while \(latestDecision\.decision_json\.decision === "continue"\)/);
  assert.match(stage, /selectedActionPlans/);
  assert.match(stage, /startTargetedDiscoveryPass/);
  assert.match(stage, /completeTargetedDiscoverySegmentPass/);
  assert.match(stage, /finalizeTargetedDiscoveryPass/);
  assert.match(
    stage,
    /status: decisionKind === "stop" \? "completed" : "partial"/,
  );
  assert.doesNotMatch(
    stage,
    /status: decisionKind === "stop" \? "completed" : "blocked"/,
  );
});

test("targeted discovery freezes history before a pass and recomputes cumulative coverage", () => {
  assert.match(stage, /maximumPassNumber: passNumber - 1/);
  assert.match(stage, /maximumPassNumber: passNumber/);
  assert.match(history, /previousQueryFingerprints/);
  assert.match(history, /candidateIdentityHints/);
  assert.match(history, /providerCalls/);
  assert.match(stage, /globalPlausibleCandidateHints/);
  assert.match(stage, /marginalUniqueYieldPerCall/);
  assert.match(stage, /consecutiveLowYieldPasses/);
});

test("targeted provider work remains globally bounded and query-plan replay safe", () => {
  assert.match(stage, /allocatedCalls > remainingBeforePass/);
  assert.match(stage, /freezeDiscoveryQueryPlan/);
  assert.match(stage, /previousQueryFingerprints/);
  assert.match(stage, /mapWithConcurrency\(batches, 2/);
  assert.match(generator, /targetedCandidates/);
  assert.match(generator, /expectedGapId: action\.gapId/);
});

test("worker repositories use dedicated targeted-pass transitions", () => {
  assert.match(repository, /start_targeted_discovery_pass_v2/);
  assert.match(repository, /complete_targeted_discovery_segment_pass_v2/);
  assert.match(repository, /finalize_targeted_discovery_pass_v2/);
});
