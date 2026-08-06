import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { IntelligenceSchemaRegistry } from "./schema-registry.ts";
import { IntelligenceTaskRegistry } from "./task-registry.ts";
import {
  executeValidatedAiTask,
  type AiTransportResult,
  type IntelligenceAttemptRecord,
  type IntelligenceTaskCache,
} from "./execute-ai-task.ts";
import { intelligenceResultCacheKey } from "./cache-key.ts";
import { classifyIntelligenceExecutionError } from "./execution-errors.ts";

function runtime(input?: { repair?: boolean; semanticFailure?: boolean }) {
  const schemas = new IntelligenceSchemaRegistry();
  schemas.register({
    taskId: "test.task",
    schemaVersion: "test-schema-v1",
    schema: z.object({ answer: z.string() }).strict(),
    semanticValidators: input?.semanticFailure
      ? [() => { throw new Error("Unknown evidence reference."); }]
      : [],
  });
  const registry = new IntelligenceTaskRegistry();
  registry.register({
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    schemaVersion: "test-schema-v1",
    contextCompilerVersion: "test-context-v1",
    modelRole: "low_risk_transformation",
    title: "Test",
    description: "Test",
    buildMessages: () => [{ role: "system", content: "Return an answer." }],
    outputSchema: z.object({ answer: z.string() }).strict(),
    maxCompletionTokens: 100,
    reasoningClass: "minimal",
    allowsRepair: input?.repair ?? false,
    allowsFallback: true,
  });
  return { schemas, registry };
}

function transport(output: unknown, suffix = "1"): AiTransportResult {
  return {
    output,
    requestedModel: "provider/model",
    actualModel: "provider/model",
    fallbackUsed: false,
    requestHash: `request-${suffix}`,
    responseHash: `response-${suffix}`,
    latencyMs: 10,
    inputUnits: 20,
    outputUnits: 5,
    actualCost: 0.01,
    currency: "USD",
  };
}

test("shared executor uses strict output only for a compatible provider and schema", async () => {
  const { schemas, registry } = runtime();
  const modes: string[] = [];
  const result = await executeValidatedAiTask<Record<string, never>, { answer: string }>({
    schemas,
    registry,
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    modelRouteVersion: "route-v1",
    request: {},
    supportsStructuredOutput: () => true,
    transport: async (request) => {
      modes.push(request.output.mode);
      return transport({ answer: "ok" });
    },
  });
  assert.deepEqual(modes, ["json_schema"]);
  assert.equal(result.data.answer, "ok");
  assert.equal(result.provenance.structuredOutputUsed, true);
  assert.equal(result.provenance.attemptCount, 1);
});

test("shared executor audits rejected strict output and falls back to JSON mode", async () => {
  const { schemas, registry } = runtime();
  const attempts: IntelligenceAttemptRecord[] = [];
  const modes: string[] = [];
  const result = await executeValidatedAiTask<Record<string, never>, { answer: string }>({
    schemas,
    registry,
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    modelRouteVersion: "route-v1",
    request: {},
    transport: async (request) => {
      modes.push(request.output.mode);
      if (request.output.mode === "json_schema") {
        throw new Error("The specified schema produces a constraint with too many states.");
      }
      return transport({ answer: "fallback" }, "2");
    },
    recordAttempt: async (attempt) => { attempts.push(attempt); },
  });
  assert.deepEqual(modes, ["json_schema", "json_object"]);
  assert.deepEqual(attempts.map(({ status }) => status), ["failed", "completed"]);
  assert.equal(result.provenance.structuredOutputFallbackUsed, true);
  assert.equal(result.provenance.attemptCount, 2);
  assert.equal(result.provenance.repairAttempted, false);
});

test("shared executor repairs one invalid response and audits both outcomes", async () => {
  const { schemas, registry } = runtime({ repair: true });
  const outputs = [{ wrong: true }, { answer: "repaired" }];
  const attempts: IntelligenceAttemptRecord[] = [];
  const modes: string[] = [];
  const result = await executeValidatedAiTask<Record<string, never>, { answer: string }>({
    schemas,
    registry,
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    modelRouteVersion: "route-v1",
    request: {},
    transport: async (request) => {
      modes.push(request.output.mode);
      return transport(outputs.shift(), String(modes.length));
    },
    recordAttempt: async (attempt) => { attempts.push(attempt); },
  });
  assert.equal(result.data.answer, "repaired");
  assert.deepEqual(modes, ["json_schema", "json_object"]);
  assert.deepEqual(attempts.map(({ status }) => status), ["failed", "completed"]);
  assert.equal(attempts[0]?.errorCode, "AI_SCHEMA_VALIDATION_FAILED");
  assert.equal(result.provenance.repairAttempted, true);
  assert.equal(result.provenance.latencyMs, 20);
});

test("shared executor classifies and audits transport failures", async () => {
  const { schemas, registry } = runtime();
  const attempts: IntelligenceAttemptRecord[] = [];
  await assert.rejects(
    executeValidatedAiTask<Record<string, never>, { answer: string }>({
      schemas,
      registry,
      taskId: "test.task",
      promptVersion: "test-prompt-v1",
      modelRouteVersion: "route-v1",
      request: {},
      transport: async () => { throw new Error("request timed out"); },
      recordAttempt: async (attempt) => { attempts.push(attempt); },
    }),
    (error: unknown) => classifyIntelligenceExecutionError(error).code === "AI_TRANSPORT_TIMEOUT",
  );
  assert.equal(attempts[0]?.status, "failed");
  assert.equal(attempts[0]?.errorCode, "AI_TRANSPORT_TIMEOUT");
});

test("shared executor distinguishes incomplete JSON from schema violations", async () => {
  const { schemas, registry } = runtime();
  const attempts: IntelligenceAttemptRecord[] = [];
  await assert.rejects(
    executeValidatedAiTask<Record<string, never>, { answer: string }>({
      schemas,
      registry,
      taskId: "test.task",
      promptVersion: "test-prompt-v1",
      modelRouteVersion: "route-v1",
      request: {},
      transport: async () => transport('{"answer":'),
      recordAttempt: async (attempt) => { attempts.push(attempt); },
    }),
    (error: unknown) => classifyIntelligenceExecutionError(error).code === "AI_INVALID_JSON",
  );
  assert.equal(attempts[0]?.errorCode, "AI_INVALID_JSON");
});

test("shared executor records semantic failures after shape validation", async () => {
  const { schemas, registry } = runtime({ semanticFailure: true });
  const attempts: IntelligenceAttemptRecord[] = [];
  await assert.rejects(
    executeValidatedAiTask<Record<string, never>, { answer: string }>({
      schemas,
      registry,
      taskId: "test.task",
      promptVersion: "test-prompt-v1",
      modelRouteVersion: "route-v1",
      request: {},
      transport: async () => transport({ answer: "unsupported" }),
      recordAttempt: async (attempt) => { attempts.push(attempt); },
    }),
    (error: unknown) =>
      classifyIntelligenceExecutionError(error).code === "AI_SEMANTIC_VALIDATION_FAILED",
  );
  assert.equal(attempts[0]?.errorCode, "AI_SEMANTIC_VALIDATION_FAILED");
});

test("shared cache key is version-bound and cached results bypass transport", async () => {
  const identity = {
    taskId: "test.task",
    frozenInputHash: "input-hash",
    promptVersion: "test-prompt-v1",
    schemaVersion: "test-schema-v1",
    contextCompilerVersion: "test-context-v1",
    modelRouteVersion: "route-v1",
  };
  const key = intelligenceResultCacheKey(identity);
  assert.equal(key, intelligenceResultCacheKey(identity));
  assert.notEqual(key, intelligenceResultCacheKey({ ...identity, promptVersion: "v2" }));
  const { schemas, registry } = runtime();
  let calls = 0;
  const values = new Map<string, unknown>();
  const cache: IntelligenceTaskCache = {
    get: async <T>(cacheKey: string) => (values.get(cacheKey) as T | undefined) ?? null,
    put: async (cacheKey, value) => { values.set(cacheKey, value); },
  };
  const cacheHits: string[] = [];
  const execute = () => executeValidatedAiTask<Record<string, never>, { answer: string }>({
    schemas,
    registry,
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    modelRouteVersion: "route-v1",
    request: {},
    cache,
    cacheKey: key,
    recordCacheHit: async (event) => {
      cacheHits.push(event.cacheKey);
    },
    transport: async () => { calls += 1; return transport({ answer: "cached" }); },
  });
  assert.equal((await execute()).provenance.cacheHit, false);
  assert.equal((await execute()).provenance.cacheHit, true);
  assert.deepEqual(cacheHits, [key]);
  assert.equal(calls, 1);
});
