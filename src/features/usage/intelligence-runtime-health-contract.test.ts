import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/(app)/usage/page.tsx", "utf8");
const health = readFileSync(
  "src/features/usage/IntelligenceRuntimeHealth.tsx",
  "utf8",
);

test("internal usage exposes workspace-scoped Intelligence runtime health", () => {
  assert.match(
    page,
    /getIntelligenceRuntimeMetrics\(\{ workspaceId: currentWorkspace\.id \}\)/,
  );
  assert.match(page, /IntelligenceRuntimeHealth/);
  assert.match(health, /evaluateIntelligenceReleaseMetric/);
  assert.match(health, /successfulOutputRate/);
  assert.match(health, /repairRate/);
  assert.match(health, /fallbackRate/);
  assert.match(health, /timeoutRate/);
  assert.match(health, /truncationRate/);
  assert.match(health, /p95LatencyMs/);
  assert.match(health, /totalCost/);
});
