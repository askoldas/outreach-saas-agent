import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CANDIDATE_RESEARCH_WAVE_SIZE,
  partitionResearchWaves,
} from "../lib/candidate-intelligence-v2/research-waves.ts";

test("candidate research is partitioned into centralized bounded waves", () => {
  const members = Array.from({ length: 29 }, (_, index) => `member-${index + 1}`);
  const waves = partitionResearchWaves(members, DEFAULT_CANDIDATE_RESEARCH_WAVE_SIZE);
  assert.deepEqual(waves.map((wave) => wave.length), [12, 12, 5]);
  assert.deepEqual(waves.flat(), members);
});

test("research waves reject unsafe sizes", () => {
  assert.throws(() => partitionResearchWaves(["member-1"], 0), /positive integer/);
});
