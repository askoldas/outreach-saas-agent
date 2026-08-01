import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { IntelligenceSchemaRegistry } from "../runtime/schema-registry.ts";
import { IntelligenceTaskRegistry } from "../runtime/task-registry.ts";
import { profileV3TaskDefinitions } from "./task-contracts.ts";

test("all V3 profile model stages register as independent versioned tasks", () => {
  const tasks = new IntelligenceTaskRegistry();
  const schemas = new IntelligenceSchemaRegistry();
  for (const definition of profileV3TaskDefinitions) {
    tasks.register(definition);
    schemas.register({
      taskId: definition.taskId,
      schemaVersion: definition.schemaVersion,
      schema: definition.outputSchema,
      semanticValidators: [],
    });
  }
  assert.deepEqual(
    profileV3TaskDefinitions.map((definition) => definition.taskId),
    [
      "profile.fact_extraction",
      "profile.commercial_synthesis",
      "profile.offering_decomposition",
      "profile.buyer_logic",
      "profile.clarification",
      "profile.consistency_audit",
    ],
  );
});

test("profile task prompts include evidence, uncertainty, and injection boundaries", () => {
  for (const definition of profileV3TaskDefinitions) {
    const prompt = definition
      .buildMessages({ evidence: [] })
      .map((message) => message.content)
      .join(" ");
    assert.match(prompt, /supplied evidence/i);
    assert.match(prompt, /untrusted data/i);
    assert.match(prompt, /never invent/i);
    assert.match(prompt, /schema-valid JSON/i);
    assert.match(prompt, /Exact output JSON Schema/i);
    assert.match(prompt, /additionalProperties/);
  }
});

test("fact extraction receives every required atomic fact field in its prompt", () => {
  const definition = profileV3TaskDefinitions.find(
    ({ taskId }) => taskId === "profile.fact_extraction",
  );
  assert.ok(definition);
  const prompt = definition
    .buildMessages({ evidence: [] })
    .map((message) => message.content)
    .join(" ");
  for (const field of [
    "factId",
    "factFamily",
    "fieldHint",
    "subject",
    "predicate",
    "value",
    "epistemicStatus",
    "confidence",
    "evidenceIds",
  ]) {
    assert.match(prompt, new RegExp(field));
  }
  assert.match(definition.promptVersion, /-v2$/);
});

test("commercial synthesis is compact and has enough completion headroom", () => {
  const definition = profileV3TaskDefinitions.find(
    ({ taskId }) => taskId === "profile.commercial_synthesis",
  );
  assert.ok(definition);
  assert.equal(definition.schemaVersion, "profile-commercial-synthesis-schema-v2");
  assert.match(definition.promptVersion, /-v3$/);
  assert.equal(definition.maxCompletionTokens, 7_000);
  const schema = JSON.stringify(z.toJSONSchema(definition.outputSchema));
  assert.match(schema, /"primaryRoles"[\s\S]*?"maxItems":6/);
  assert.match(schema, /"commercialConstraints"[\s\S]*?"maxItems":12/);
  assert.match(schema, /"unresolvedCommercialQuestions"[\s\S]*?"maxItems":12/);
});

test("profile buyer rules expose only durable profile scopes", () => {
  const definition = profileV3TaskDefinitions.find(
    ({ taskId }) => taskId === "profile.buyer_logic",
  );
  assert.ok(definition);
  assert.equal(definition.schemaVersion, "profile-buyer-logic-schema-v3");
  assert.match(definition.promptVersion, /-v4$/);
  const schema = JSON.stringify(z.toJSONSchema(definition.outputSchema));
  assert.match(schema, /"scope":\{"type":"string","enum":\["workspace","offering"\]\}/);
  assert.doesNotMatch(schema, /"scope"[\s\S]*?"candidate"/);
  assert.match(definition.description, /never campaign or candidate scope/i);
});

test("profile clarification questions are always optional", () => {
  const definition = profileV3TaskDefinitions.find(
    ({ taskId }) => taskId === "profile.clarification",
  );
  assert.ok(definition);
  assert.equal(definition.schemaVersion, "profile-clarification-schema-v2");
  assert.match(definition.promptVersion, /-v3$/);
  const schema = JSON.stringify(z.toJSONSchema(definition.outputSchema));
  assert.match(schema, /"skipAllowed":\{"type":"boolean","const":true\}/);
  assert.match(definition.description, /unanswered questions never block/i);
});

test("profile consistency audits the assembled profile and treats questions as advisory", () => {
  const definition = profileV3TaskDefinitions.find(
    ({ taskId }) => taskId === "profile.consistency_audit",
  );
  assert.ok(definition);
  assert.match(definition.promptVersion, /-v3$/);
  assert.match(definition.description, /profileUnderAudit/);
  assert.match(definition.description, /draftSnapshot as a seed/);
  assert.match(definition.description, /unanswered questions alone must never/i);
});
