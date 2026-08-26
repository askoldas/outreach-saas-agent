import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync("src/server/research/repository.ts", "utf8");

test("campaign progress projects durable Candidate Research member completion", () => {
  assert.match(repository, /loadLiveCandidateResearchProgress/);
  assert.match(repository, /candidate_research_batch_members_v2/);
  assert.match(
    repository,
    /50 \+ Math\.round\(\(liveResearch\.completed \/ liveResearch\.total\) \* 17\)/,
  );
  assert.match(
    repository,
    /Researching candidates \(\$\{liveResearch\.completed\}\/\$\{liveResearch\.total\}\)/,
  );
});

test("live research completion updates deeply researched count", () => {
  assert.match(
    repository,
    /companiesEvaluated: Math\.max\([\s\S]*liveResearch\?\.completed/,
  );
});
