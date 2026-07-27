import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728001100_semantic_discovery_coverage.sql",
  "utf8",
);

test("WP-13 creates semantic plan, execution, query, coverage, gap, and usage stores", () => {
  for (const table of [
    "discovery_plans",
    "discovery_segments",
    "discovery_source_plans",
    "discovery_runs",
    "discovery_segment_runs",
    "discovery_queries",
    "discovery_coverage_snapshots",
    "discovery_gaps",
    "discovery_gap_actions",
    "discovery_usage_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
});

test("plans freeze confirmed strategy, memory, routes, and policies atomically", () => {
  assert.match(migration, /confirmation_status = 'confirmed'/i);
  assert.match(
    migration,
    /campaign_strategy_version_id = new\.campaign_strategy_version_id/i,
  );
  assert.match(migration, /create or replace function public\.create_discovery_plan_v2/i);
  assert.match(migration, /Semantic segment has no provider route/i);
  assert.match(migration, /coverage_policy_json/i);
  assert.match(migration, /stopping_policy_json/i);
  assert.match(migration, /budget_policy_json/i);
});

test("provider execution and query audit are attached to an exact Segment Run", () => {
  assert.match(migration, /add column discovery_segment_run_id uuid/i);
  assert.match(migration, /Provider execution does not belong to its Segment Run/i);
  assert.match(
    migration,
    /create or replace function public\.record_discovery_query_audit_v2/i,
  );
  assert.match(migration, /unique \(provider_execution_id, fingerprint\)/i);
});

test("coverage, gaps, actions, and stopping decision persist in one transaction", () => {
  assert.match(
    migration,
    /create or replace function public\.persist_discovery_coverage_decision_v2/i,
  );
  const coverage = migration.indexOf("insert into public.discovery_coverage_snapshots");
  const gaps = migration.indexOf("insert into public.discovery_gaps");
  const actions = migration.indexOf("insert into public.discovery_gap_actions");
  const decision = migration.indexOf("continuation_decision_json = target_decision");
  assert.ok(coverage > 0 && gaps > coverage && actions > gaps && decision > actions);
  assert.match(migration, /Cross-workspace Semantic Discovery association/i);
  assert.match(migration, /enable row level security/i);
});
