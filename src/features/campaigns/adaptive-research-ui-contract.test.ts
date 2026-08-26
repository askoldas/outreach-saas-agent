import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);

test("campaign UI uses strict research funnel semantics without count targets", async () => {
  const [results, controls, summary] = await Promise.all([
    readFile(new URL("CampaignV2Results.tsx", root), "utf8"),
    readFile(new URL("CampaignControls.tsx", root), "utf8"),
    readFile(new URL("CampaignWorkflowSummary.tsx", root), "utf8"),
  ]);
  assert.match(results, /source records scanned/);
  assert.match(results, /organization references identified/);
  assert.match(results, /unique organizations resolved/);
  assert.match(results, /deeply researched/);
  assert.match(results, /Additional market opportunity remains/);
  assert.doesNotMatch(controls, /Qualified-company target/);
  assert.doesNotMatch(controls, /\/ 5/);
  assert.doesNotMatch(summary, /target \{segment\.targetCandidateCount\}/);
});
