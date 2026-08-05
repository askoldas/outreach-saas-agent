import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const migratedV2Adapters = [
  "src/lib/ai/campaign-brief-proposal.ts",
  "src/lib/ai/draft-generation.ts",
  "src/lib/discovery-v2/candidate-preclassification-model.ts",
  "src/lib/intelligence/campaign-strategy-v2/market-strategy.ts",
  "src/server/candidate-research-v2/candidate-worker.ts",
  "src/server/company-profile-v3/stage-service.ts",
  "src/server/qualification-v2/candidate-worker.ts",
] as const;

const activeV2Exceptions = [] as const;

const legacyOrInactiveCallers = [] as const;

test("migrated V2 provider adapters execute through the shared runtime", () => {
  for (const file of migratedV2Adapters) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /executeValidatedAiTask/, file);
    assert.match(source, /generateTextResult/, file);
  }
});

test("the remaining direct V2 provider exceptions are explicit and bounded", () => {
  assert.deepEqual(activeV2Exceptions, []);
  for (const file of activeV2Exceptions) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /generateTextResult/, file);
    assert.doesNotMatch(source, /executeValidatedAiTask/, file);
  }
});

test("every production OpenRouter call site belongs to a reviewed boundary class", () => {
  const reviewed = new Set<string>([
    ...migratedV2Adapters,
    ...activeV2Exceptions,
    ...legacyOrInactiveCallers,
  ]);
  const discovered = providerCallers();
  assert.deepEqual([...discovered].sort(), [...reviewed].sort());
});

function providerCallers() {
  const output = execFileSync(
    "rg",
    [
      "-l",
      "generateText(?:Result)?\\(|generateTextResult\\)\\s*\\(",
      "src",
      "--glob",
      "!**/*.test.ts",
    ],
    { encoding: "utf8" },
  );
  return new Set(
    output
      .split(/\r?\n/)
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => file && file !== "src/lib/providers/openrouter.ts"),
  );
}
