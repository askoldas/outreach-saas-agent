import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const relationships = readFileSync("supabase/migrations/20260904000700_seller_relationship_suppression.sql", "utf8");
const initializer = readFileSync("supabase/migrations/20260904000800_explicit_candidate_research_initializer.sql", "utf8");

test("trusted first-campaign relationship memory is loaded before research", () => {
  assert.match(relationships, /organization_relationship_memories_v2/);
  assert.match(relationships, /existing_customer/);
  assert.match(relationships, /evidence_ids/);
  assert.match(relationships, /load_pre_research_suppression_context_v2/);
});

test("final Candidate Research initializer is explicit and catalog-independent", () => {
  assert.match(initializer, /create or replace function public\.initialize_candidate_research_batch_v2/);
  assert.match(initializer, /research_cycle_id = research_cycle\.id/);
  assert.match(initializer, /plan subset exceeds the resolved pool/);
  assert.doesNotMatch(initializer, /pg_get_functiondef|pg_catalog\.pg_proc|regexp_replace|execute\s+revised/i);
});
