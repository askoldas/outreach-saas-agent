import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCampaignRunTelemetry } from "./telemetry-aggregate.ts";

test("raw internal telemetry preserves provider currencies and discovery counts", () => {
  const telemetry = aggregateCampaignRunTelemetry({
    aiRequests: [
      {
        actual_cost: 0.03,
        completed_at: "2026-07-27T10:00:02.000Z",
        currency: "USD",
        input_units: 120,
        metadata: {},
        output_units: 40,
        provider: "openrouter",
        selected_model: "vendor/model",
        started_at: "2026-07-27T10:00:00.000Z",
        status: "completed",
      },
    ],
    candidateStatuses: ["promising", "possible", "duplicate"],
    providerExecutions: [
      {
        actual_cost: 0,
        completed_at: "2026-07-27T10:00:03.000Z",
        error_code: null,
        id: "execution-1",
        input_units: null,
        metadata: { attemptFailures: [{ attempt: 1 }] },
        operation: "campaign_discovery",
        output_units: null,
        provider: "tavily_openrouter",
        provider_cost: 0.01,
        provider_currency: "USD",
        started_at: "2026-07-27T10:00:00.000Z",
        status: "completed",
      },
    ],
    qualificationStatuses: ["qualified", "not_relevant"],
    rawCandidateCount: 3,
    searchProviders: ["tavily", "tavily"],
  });

  assert.equal(telemetry.providerRequestCount, 3);
  assert.equal(telemetry.searchRequestCount, 2);
  assert.equal(telemetry.inputTokens, 120);
  assert.equal(telemetry.outputTokens, 40);
  assert.equal(telemetry.rawCandidateCount, 3);
  assert.equal(telemetry.classifiedCandidateCount, 3);
  assert.equal(telemetry.acceptedCandidateCount, 1);
  assert.equal(telemetry.rejectedCandidateCount, 1);
  assert.equal(telemetry.duplicateCandidateCount, 1);
  assert.equal(telemetry.providerRetryCount, 1);
  assert.deepEqual(
    telemetry.costObservations.map((item) => item.currency),
    ["USD", "USD"],
  );
  assert.deepEqual(
    telemetry.requestDurationsMs.map((item) => item.durationMs),
    [3000, 2000],
  );
});

test("telemetry groups raw failure categories without billing calculations", () => {
  const telemetry = aggregateCampaignRunTelemetry({
    aiRequests: [],
    candidateStatuses: [],
    providerExecutions: [
      execution("retryable_network"),
      execution("retryable_network"),
      execution("validation"),
    ],
    qualificationStatuses: [],
    rawCandidateCount: 0,
    searchProviders: [],
  });

  assert.deepEqual(telemetry.failureCategories, {
    retryable_network: 2,
    validation: 1,
  });
  assert.equal("credits" in telemetry, false);
  assert.equal("convertedCost" in telemetry, false);
});

function execution(errorCode: string) {
  return {
    actual_cost: 0,
    completed_at: null,
    error_code: errorCode,
    id: errorCode,
    input_units: null,
    metadata: {},
    operation: "campaign_discovery",
    output_units: null,
    provider: "tavily",
    provider_cost: null,
    provider_currency: null,
    started_at: null,
    status: "failed",
  };
}
