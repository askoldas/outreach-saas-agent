import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const form = readFileSync(
  fileURLToPath(new URL("./CampaignBriefForm.tsx", import.meta.url)),
  "utf8",
);

test("campaign Target keeps essentials visible and secondary fields advanced", () => {
  const targetStep = form.slice(form.indexOf("{step === 3"), form.indexOf("{step === 4"));
  const advanced = targetStep.slice(targetStep.indexOf("<details"));

  assert.match(targetStep, /label="Summary"/);
  assert.match(targetStep, /label="Company types"/);
  assert.match(targetStep, /label="Industries"/);
  assert.match(advanced, /<summary>Advanced targeting<\/summary>/);
  assert.match(advanced, /label="Positive signals"/);
  assert.match(advanced, /label="Required criteria"/);
  assert.match(advanced, /label="Exclude"/);
});
