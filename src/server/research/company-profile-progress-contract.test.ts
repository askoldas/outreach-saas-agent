import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/server/research/repository.ts", "utf8");

test("Company Intelligence progress counts the latest attempt for each stage", () => {
  assert.match(repository, /latestStageByTask = new Map/);
  assert.match(repository, /latestStages = profileV3StageOrder\.flatMap/);
  assert.match(repository, /completedStageCount = latestStages\.filter/);
});

test("successful terminal drafts suppress stale retry failures", () => {
  assert.match(
    repository,
    /completedTasks = terminal \? profileV3StageOrder\.length : completedStageCount/,
  );
  assert.match(repository, /status === "failed"[\s\S]*failedTask\?\.error_message/);
  assert.match(
    repository,
    /failedTasks: status === "failed" \? Math\.max\(1, failedStageCount\) : 0/,
  );
});
