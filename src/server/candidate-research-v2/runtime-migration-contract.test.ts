import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = [
  "supabase/migrations/20260728002300_retry_safe_candidate_research_stage.sql",
  "supabase/migrations/20260728002400_retry_safe_candidate_research_stage_part_2.sql",
]
  .map(source)
  .join("\n");
const worker = source("src/server/candidate-research-v2/candidate-worker.ts");
const sourceService = source("src/server/candidate-research-v2/source-service.ts");
const stageService = source("src/server/candidate-research-v2/stage-service.ts");
const trigger = source("src/trigger/research-campaign-candidates-v2.ts");

test("Candidate research freezes one exact run-scoped batch after Entity Resolution", () => {
  assert.match(migration, /create table public\.candidate_research_batches_v2/i);
  assert.match(migration, /unique \(campaign_run_id\)[\s\S]*entity_resolution_batch_id/i);
  assert.match(
    migration,
    /resolution_case\.entity_resolution_batch_id = resolution_batch\.id/i,
  );
  assert.match(migration, /plan set does not match Entity Resolution/i);
  assert.match(migration, /input changed after it was frozen/i);
  assert.match(migration, /campaign_workflow = 'v2'/i);
  assert.match(migration, /result_write_mode = 'canonical'/i);
  assert.match(migration, /shadow_mode = false/i);
});

test("Research evidence retains V2 provider or first-party fetch provenance", () => {
  assert.match(migration, /add column discovery_provider_execution_id uuid/i);
  assert.match(migration, /add column candidate_page_fetch_id uuid/i);
  assert.match(migration, /evidence_items_exactly_one_source_v2_check/i);
  assert.match(migration, /create table public\.candidate_research_source_artifacts_v2/i);
  assert.match(migration, /length\(content_text\) between 1 and 100000/i);
  assert.match(migration, /First-party source is outside the canonical domain/i);
  assert.match(migration, /does not match frozen raw evidence/i);
  assert.match(migration, /expected_discovery_page_kind := 'other'/i);
  assert.doesNotMatch(migration, /target_page_kind <> case/i);
  assert.match(sourceService, /maximumFirstPartyFetches > 0/);
  assert.doesNotMatch(sourceService, /minimumReusableContentLength/);
  assert.match(sourceService, /member\.plan\.pageBudget/);
  assert.match(sourceService, /member\.sourcePlan\.preferredPages/);
  assert.match(sourceService, /searchWeb/);
  assert.match(
    migration,
    /page_fetch\.expires_at > now\(\)[\s\S]*on conflict \(candidate_research_member_id, source_artifact_id\) do nothing/i,
  );
});

test("Paid extraction and candidate completion are separately replay safe", () => {
  assert.match(migration, /save_candidate_research_extraction_v2/i);
  assert.match(migration, /'extract:' \|\| target_request_hash/i);
  assert.match(migration, /Candidate Research member is not running/i);
  assert.match(
    migration,
    /if member\.status in \('completed', 'blocked'\)[\s\S]*return member\.output_reference_json/i,
  );
  assert.match(worker, /findCandidateResearchExtraction/);
  assert.match(worker, /saveCandidateResearchExtraction/);
  assert.match(worker, /completeCandidateResearchMember/);
  assert.match(worker, /executeValidatedAiTask/);
  assert.match(worker, /createIntelligenceAttemptRecorder/);
  assert.match(worker, /IntelligenceTaskRegistry/);
  assert.match(worker, /IntelligenceSchemaRegistry/);
  assert.doesNotMatch(worker, /parseCompleteJsonObject/);
});

test("Stage retries reuse the frozen batch before reading mutable candidate state", () => {
  assert.match(stageService, /findCandidateResearchBatch\(input\)/);
  assert.match(
    stageService,
    /if \(frozenBatch\) return frozenBatch;[\s\S]*loadCampaignResearchContext\(input\)/,
  );
});

test("Research fans candidates out with bounded Trigger concurrency", () => {
  assert.match(trigger, /id: "research-campaign-candidate-v2"/);
  assert.match(trigger, /concurrencyLimit: 4/);
  assert.match(trigger, /batchTriggerAndWait/);
  assert.match(trigger, /completed candidate work remains cached/);
  assert.doesNotMatch(trigger, /Promise\.all/);
});

test("Candidate research writes evidence and claims without deciding fit", () => {
  assert.match(migration, /insert into public\.intelligence_claims/i);
  assert.match(
    migration,
    /if claim_item->>'reusableScope' = 'organization' then[\s\S]*insert into public\.candidate_claims/i,
  );
  assert.match(
    migration,
    /if claim_item->>'reusableScope' <> 'organization' then[\s\S]*insert into public\.campaign_candidate_claims/i,
  );
  assert.match(migration, /insert into public\.candidate_intelligence_versions/i);
  assert.match(migration, /unresolved_question_keys_json/i);
  assert.match(migration, /prior_intelligence\.claim_ids_json/i);
  assert.match(migration, /deferredReusableQuestionKeys/i);
  assert.match(migration, /claim_is_conflicting[\s\S]*reusable_status/i);
  assert.match(
    migration,
    /intelligence_version\.organization_id = organization\.id[\s\S]*version_number desc/i,
  );
  assert.doesNotMatch(worker, /fitScore|eligibilityDecision|rankScore/);
});

test("Candidate research runtime mutation is service-role only", () => {
  assert.match(migration, /from public, anon, authenticated;[\s\S]*to service_role;/i);
  assert.equal(
    (
      migration.match(
        /if auth\.role\(\) <> 'service_role'\s+and not public\.is_workspace_admin\(target_workspace_id\)/gi,
      ) ?? []
    ).length,
    7,
  );
});

test("Workspace cleanup removes the new evidence graph before legacy cleanup", () => {
  assert.match(migration, /rename to clear_workspace_data_before_candidate_research_v2/i);
  assert.match(migration, /set_config\(\s*'app\.workspace_cleanup_id'/i);
  assert.doesNotMatch(migration, /drop trigger if exists evidence_items_immutable/i);
  assert.match(
    migration,
    /delete from public\.candidate_research_member_sources_v2[\s\S]*delete from public\.candidate_research_plans[\s\S]*delete from public\.campaign_strategy_drafts[\s\S]*delete from public\.company_profile_drafts[\s\S]*delete from public\.evidence_items[\s\S]*clear_workspace_data_before_candidate_research_v2/i,
  );
  assert.match(migration, /delete from public\.provider_source_records/i);
});
