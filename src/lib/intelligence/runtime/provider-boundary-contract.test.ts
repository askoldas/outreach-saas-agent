import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const providerCallPattern =
  /generateText(?:Result)?\(|generateTextResult\)\s*\(/;

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
  return new Set(
    sourceFiles("src")
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => file !== "src/lib/providers/openrouter.ts")
      .filter((file) => providerCallPattern.test(readFileSync(file, "utf8"))),
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
