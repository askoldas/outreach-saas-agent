import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = [
  source(
    "supabase/migrations/20260728002500_retry_safe_candidate_qualification_stage.sql",
  ),
  source(
    "supabase/migrations/20260728002600_retry_safe_candidate_qualification_stage_part_2.sql",
  ),
].join("\n");
const worker = source("src/server/qualification-v2/candidate-worker.ts");
const trigger = source("src/trigger/qualify-campaign-candidates-v2.ts");
const workflow = source("src/server/workflow-v2/stage-service.ts");

test("Qualification freezes a settled research batch, confirmed strategy, rubric, and candidate inputs", () => {
  assert.match(migration, /load_campaign_qualification_inputs_v2/);
  assert.match(migration, /initialize_candidate_qualification_batch_v2/);
  assert.match(migration, /candidate_research_batches_v2/);
  assert.match(migration, /qualification_rubric_id/);
  assert.match(migration, /input_snapshot_json/);
  assert.match(migration, /input_hash/);
  assert.match(migration, /result_write_mode = 'canonical'/);
});

test("Qualification caches narrow AI outputs and audits paid requests", () => {
  assert.match(migration, /candidate_qualification_ai_outputs_v2/);
  assert.match(
    migration,
    /unique \(candidate_qualification_member_id, task_type, request_hash\)/,
  );
  assert.match(migration, /insert into public\.ai_requests/);
  assert.match(worker, /relationshipRequestHash/);
  assert.match(worker, /factorRequestHash/);
  assert.match(worker, /taskType: "relationship"/);
  assert.match(worker, /taskType: "factors"/);
  assert.match(worker, /executeValidatedAiTask/);
  assert.match(worker, /createIntelligenceAttemptRecorder/);
  assert.match(worker, /IntelligenceTaskRegistry/);
  assert.match(worker, /IntelligenceSchemaRegistry/);
  assert.doesNotMatch(worker, /parseCompleteJsonObject/);
});

test("Qualification persists relationship-first deterministic decisions atomically", () => {
  assert.match(migration, /complete_candidate_qualification_member_v2/);
  assert.match(migration, /candidate_relationship_assessments/);
  assert.match(migration, /candidate_factor_evaluations/);
  assert.match(migration, /candidate_score_calculations/);
  assert.match(migration, /candidate_confidence_calculations/);
  assert.match(migration, /candidate_eligibility_decisions/);
  assert.match(migration, /candidate_review_lane_assignments/);
  assert.match(worker, /calculateFit/);
  assert.match(worker, /calculatePotential/);
  assert.match(worker, /calculateOpportunityTiming/);
  assert.match(worker, /opportunityTiming/);
  assert.match(worker, /decideEligibility/);
  assert.match(worker, /assignReviewLane/);
});

test("Candidate failures are isolated behind bounded retry-safe Trigger fan-out", () => {
  assert.match(trigger, /id: "qualify-campaign-candidate-v2"/);
  assert.match(trigger, /maxAttempts: 3/);
  assert.match(trigger, /concurrencyLimit: 4/);
  assert.match(trigger, /batchTriggerAndWait/);
  assert.match(trigger, /blockQualificationMember/);
  assert.doesNotMatch(trigger, /Promise\.all/);
  assert.match(migration, /block_candidate_qualification_member_v2/);
  assert.match(migration, /finalize_candidate_qualification_batch_v2/);
});

test("Qualification runtime APIs remain service-role only and cleanup-aware", () => {
  assert.match(
    migration,
    /revoke all on function public\.initialize_candidate_qualification_batch_v2/,
  );
  assert.match(
    migration,
    /grant execute on function public\.initialize_candidate_qualification_batch_v2[\s\S]*to service_role/,
  );
  assert.match(migration, /clear_workspace_data_before_qualification_runtime_v2/);
  assert.match(migration, /delete from public\.candidate_qualification_batches_v2/);
});

test("Qualification hands off to the connected comparative ranking boundary", () => {
  assert.match(workflow, /input\.stage === "qualify_candidates"/);
  assert.match(workflow, /adapters\.qualifyCandidates/);
  assert.match(workflow, /input\.stage === "rank_candidates"/);
  assert.match(workflow, /executeRankingStage/);
  assert.match(workflow, /stage adapter.*is not implemented/s);
});
