import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  assertClaimEvidenceScope,
  evidenceReferenceSchema,
  intelligenceClaimSchema,
  intelligenceMemorySchema,
  intelligenceRuleSchema,
} from "./index.ts";
import { IntelligenceSchemaRegistry } from "../runtime/schema-registry.ts";
import { IntelligenceTaskRegistry } from "../runtime/task-registry.ts";

test("evidence references reject unknown fields and invalid URLs", () => {
  assert.throws(() =>
    evidenceReferenceSchema.parse({
      evidenceId: "e1",
      sourceId: "s1",
      sourceUrl: "not a url",
      sourceType: "website",
      retrievedAt: "2026-07-27T00:00:00.000Z",
      freshness: "current",
      sourceQuality: "first_party",
      injected: true,
    }),
  );
});

test("claim semantics reject unsupported facts and unsafe unknowns", () => {
  assert.throws(() =>
    intelligenceClaimSchema.parse({
      claimId: "c1",
      fieldPath: "company.name",
      statement: "Example",
      epistemicStatus: "explicit_fact",
      confidence: 1,
      evidenceIds: [],
    }),
  );
  assert.throws(() =>
    intelligenceClaimSchema.parse({
      claimId: "c2",
      fieldPath: "company.revenue",
      statement: "Unknown",
      value: 100,
      epistemicStatus: "unknown",
      confidence: 0.8,
      evidenceIds: [],
    }),
  );
});

test("claim evidence must remain inside the compiled context", () => {
  const claim = intelligenceClaimSchema.parse({
    claimId: "c1",
    fieldPath: "company.name",
    statement: "Example",
    epistemicStatus: "explicit_fact",
    confidence: 1,
    evidenceIds: ["e1"],
  });
  assert.throws(() => assertClaimEvidenceScope(claim, new Set(["e2"])));
});

test("AI cannot create confirmed rules", () => {
  assert.throws(() =>
    intelligenceRuleSchema.parse({
      ruleKey: "r1",
      label: "Rule",
      description: "Description",
      ruleType: "preference",
      scope: "campaign",
      strength: "soft",
      applicability: {},
      status: "confirmed",
      source: "ai",
      confidence: 0.7,
    }),
  );
});

test("memory requires explicit scope and provenance", () => {
  assert.doesNotThrow(() =>
    intelligenceMemorySchema.parse({
      id: "m1",
      workspaceId: "w1",
      scope: "campaign",
      scopeId: "c1",
      kind: "correction",
      statement: "Exclude resellers.",
      strength: "hard",
      status: "confirmed",
      source: "user",
      confidence: 1,
      evidenceIds: [],
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
    }),
  );
});

test("registries reject duplicate versions and parse strictly", () => {
  const schemas = new IntelligenceSchemaRegistry();
  schemas.register({
    taskId: "test.task",
    schemaVersion: "test-schema-v1",
    schema: z.object({ answer: z.string() }).strict(),
    semanticValidators: [],
  });
  assert.throws(() =>
    schemas.register({
      taskId: "test.task",
      schemaVersion: "test-schema-v1",
      schema: z.object({ answer: z.string() }),
      semanticValidators: [],
    }),
  );
  assert.deepEqual(schemas.parse("test.task", "test-schema-v1", { answer: "ok" }), {
    answer: "ok",
  });

  const tasks = new IntelligenceTaskRegistry();
  const definition = {
    taskId: "test.task",
    promptVersion: "test-prompt-v1",
    schemaVersion: "test-schema-v1",
    contextCompilerVersion: "test-context-v1",
    modelRole: "low_risk_transformation" as const,
    title: "Test",
    description: "Test",
    buildMessages: () => [{ role: "system" as const, content: "Test" }],
    outputSchema: z.object({ answer: z.string() }),
    maxCompletionTokens: 100,
    reasoningClass: "none" as const,
    allowsRepair: false,
    allowsFallback: false,
  };
  tasks.register(definition);
  assert.throws(() => tasks.register(definition));
});
