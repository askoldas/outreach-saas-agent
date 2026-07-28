import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const action = source("src/server/campaign-questions/actions.ts");
const clarification = source("src/features/campaigns/CampaignClarification.tsx");
const repository = source("src/server/research/repository.ts");

test("clarification is saved before an idempotent resume is dispatched", () => {
  assert.match(action, /status: "answered"/);
  assert.match(action, /enqueueCampaignAgentResume/);
  assert.match(repository, /status: "queued"/);
  assert.match(repository, /execute-campaign-resume:/);
});

test("successful clarification resets stale stopped progress state", () => {
  assert.match(clarification, /await answerCampaignQuestionAction\(formData\)/);
  assert.match(clarification, /window\.location\.reload\(\)/);
  assert.match(clarification, /pending \? "Resuming…"/);
});

test("all campaign views are revalidated after resume", () => {
  assert.match(action, /revalidatePath\(`\/campaigns\/\$\{campaignId\}`\)/);
  assert.match(action, /revalidatePath\(`\/campaigns\/\$\{campaignId\}\/discovery`\)/);
  assert.match(action, /revalidatePath\(`\/campaigns\/\$\{campaignId\}\/leads`\)/);
});
