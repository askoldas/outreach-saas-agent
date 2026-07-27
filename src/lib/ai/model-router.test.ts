import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initialModelDefaults, isFreeModel } from "./model-registry.ts";
import { modelRoles } from "./model-roles.ts";
import { getModelRoute } from "./model-router.ts";

test("every logical role resolves to its approved paid default", () => {
  for (const role of modelRoles) {
    const route = getModelRoute(role);
    assert.equal(route.primaryModel, initialModelDefaults[role]);
    assert.equal(isFreeModel(route.primaryModel), false);
    assert.equal(route.timeoutMs, 120_000);
  }
});

test("high-impact roles use the controlled paid fallback", () => {
  for (const role of [
    "campaign_planning",
    "profile_analysis",
    "company_qualification",
    "outreach_generation",
    "campaign_reflection",
  ] as const) {
    assert.deepEqual(getModelRoute(role).fallbackModels, ["openai/gpt-5-mini"]);
  }
  assert.deepEqual(getModelRoute("guided_interpretation").fallbackModels, []);
});

test("free and moving model aliases are rejected", () => {
  const previous = process.env.OPENROUTER_MODEL_PROFILE_ANALYSIS;
  process.env.OPENROUTER_MODEL_PROFILE_ANALYSIS = "vendor/model:free";
  assert.throws(() => getModelRoute("profile_analysis"), /must not use a :free/);
  process.env.OPENROUTER_MODEL_PROFILE_ANALYSIS = "vendor/latest";
  assert.throws(() => getModelRoute("profile_analysis"), /moving latest\/auto alias/);
  if (previous === undefined) delete process.env.OPENROUTER_MODEL_PROFILE_ANALYSIS;
  else process.env.OPENROUTER_MODEL_PROFILE_ANALYSIS = previous;
});

test("AI call sites request roles and do not duplicate raw production model IDs", async () => {
  const files = [
    "company-profile-analysis.ts",
    "strategy-generation.ts",
    "lead-evaluation.ts",
    "draft-generation.ts",
    "guided-interpretation.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /anthropic\/|openai\/|google\/|:free/);
    assert.match(source, /role:\s*"/);
  }
});

test("no OpenRouter secret uses a public environment variable", async () => {
  const source = await readFile(
    new URL("../providers/config.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /process\.env\.OPENROUTER_API_KEY/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_OPENROUTER/);
});

test("qualification persists the actual model selected by OpenRouter", async () => {
  const service = await readFile(
    new URL("../../server/campaign-discovery/service.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    service,
    /selected_model:\s*generated\.modelCall\.actualModel\s*\?\?\s*generated\.modelCall\.requestedModel/,
  );
});

test("current AI prompt versions match the approved structured contracts", async () => {
  const expectations = new Map([
    ["company-profile-analysis.ts", "company-profile-website-v5-bounded-recovery"],
    ["offering-proposals.ts", "profile-offering-proposals-v1"],
    ["target-segment-proposals.ts", "campaign-target-segments-v1"],
    ["structured-change-interpretation.ts", "structured-additive-changes-v1"],
    ["strategy-generation.ts", "campaign-strategy-v1"],
    ["lead-evaluation.ts", "lead-evaluator-v1"],
    ["draft-generation.ts", "grounded-outreach-draft-v1"],
    ["guided-interpretation.ts", "guided-change-v2"],
  ]);
  for (const [file, promptVersion] of expectations) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, new RegExp(promptVersion));
  }
});
