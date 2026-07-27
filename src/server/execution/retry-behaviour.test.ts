import assert from "node:assert/strict";
import test from "node:test";
import { executeProviderAttempt } from "./provider-attempt.ts";

function transientProviderError(message: string) {
  return Object.assign(new Error(message), { code: "provider_unavailable" });
}

test("a transient attempt failure can retry to one logical completion", async () => {
  const events: string[] = [];
  let providerCalls = 0;
  const lifecycle = {
    onStarted: async () => void events.push("started"),
    onCompleted: async () => void events.push("completed"),
    onAttemptFailure: async () => void events.push("attempt_failed"),
  };
  const provider = async () => {
    providerCalls += 1;
    if (providerCalls === 1) throw transientProviderError("temporary");
    return { candidateCount: 1 };
  };

  await assert.rejects(() => executeProviderAttempt(provider, lifecycle));
  const result = await executeProviderAttempt(provider, lifecycle);

  assert.deepEqual(result, { candidateCount: 1 });
  assert.equal(providerCalls, 2);
  assert.deepEqual(events, ["started", "attempt_failed", "started", "completed"]);
});

test("failed attempts never execute the logical completion transition", async () => {
  let terminalCompletions = 0;
  let attemptFailures = 0;
  const lifecycle = {
    onStarted: async () => undefined,
    onCompleted: async () => void (terminalCompletions += 1),
    onAttemptFailure: async () => void (attemptFailures += 1),
  };

  await assert.rejects(() =>
    executeProviderAttempt(async () => {
      throw transientProviderError("still unavailable");
    }, lifecycle),
  );

  assert.equal(attemptFailures, 1);
  assert.equal(terminalCompletions, 0);
});
