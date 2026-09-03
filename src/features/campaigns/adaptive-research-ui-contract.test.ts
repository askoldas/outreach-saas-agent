import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("./", import.meta.url);

test("campaign UI keeps internal funnel detail while leading with the outcome target", async () => {
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
  assert.match(results, /results\.outcome\.deliveredCompanyCount/);
  assert.match(results, /outcomeCopy\.description/);
  assert.match(controls, /targetCompanyCount/);
  assert.match(controls, /confirmed/);
  assert.doesNotMatch(controls, /Maximum research credits/);
  assert.doesNotMatch(controls, /Tasks failed/);
  assert.match(controls, /label="Confirmed companies"/);
  assert.doesNotMatch(summary, /target \{segment\.targetCandidateCount\}/);
});
