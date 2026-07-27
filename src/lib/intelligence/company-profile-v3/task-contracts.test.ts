import assert from "node:assert/strict";
import test from "node:test";
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
  }
});
