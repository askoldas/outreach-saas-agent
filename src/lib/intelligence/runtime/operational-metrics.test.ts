import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateIntelligenceReleaseMetric,
  type IntelligenceRuntimeMetric,
} from "./operational-metrics.ts";

const healthy: IntelligenceRuntimeMetric = {
  taskId: "campaign_strategy.market_context",
  actualModel: "model-a",
  initialAttempts: 100,
  completedOutputs: 99,
  failedAttempts: 1,
  repairAttempts: 5,
  fallbackAttempts: 2,
  timeoutAttempts: 0,
  truncationAttempts: 0,
  semanticFailureAttempts: 1,
  successfulOutputRate: 0.99,
  repairRate: 0.05,
  fallbackRate: 0.02,
  timeoutRate: 0,
  truncationRate: 0,
  p50LatencyMs: 10_000,
  p95LatencyMs: 45_000,
  totalInputUnits: 1000,
  totalOutputUnits: 500,
  totalCost: 1.25,
  currency: "USD",
};

test("healthy Intelligence runtime metrics pass release thresholds", () => {
  assert.deepEqual(evaluateIntelligenceReleaseMetric(healthy), {
    passed: true,
    failures: [],
  });
});

test("release evaluation reports every breached operational threshold", () => {
  const result = evaluateIntelligenceReleaseMetric({
    ...healthy,
    successfulOutputRate: 0.9,
    repairRate: 0.2,
    fallbackRate: 0.2,
    timeoutRate: 0.03,
    truncationRate: 0.04,
    p95LatencyMs: 130_000,
  });
  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, [
    "successful_output_rate",
    "repair_rate",
    "fallback_rate",
    "timeout_rate",
    "truncation_rate",
    "p95_latency_ms",
  ]);
});

