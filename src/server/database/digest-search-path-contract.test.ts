import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729000800_fix_v2_digest_search_paths.sql",
  "utf8",
);

test("every active V2 RPC that hashes database payloads can resolve pgcrypto", () => {
  for (const functionName of [
    "compile_campaign_strategy_v2_draft",
    "persist_discovery_segment_coverage_once_v2",
    "finalize_discovery_pass_v2",
    "start_targeted_discovery_pass_v2",
    "complete_targeted_discovery_segment_pass_v2",
    "persist_candidate_research_source_v2",
    "save_candidate_research_extraction_v2",
    "complete_candidate_research_member_v2",
    "save_candidate_qualification_ai_output_v2",
    "persist_campaign_ranking_v2",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter function public\\.${functionName}\\([\\s\\S]*?\\)\\s*set search_path = public, extensions;`,
      ),
    );
  }
});
