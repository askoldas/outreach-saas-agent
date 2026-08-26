import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service configuration is missing.");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: run, error: runError } = await db
  .from("campaign_runs")
  .select("id,campaign_id,workspace_id,status,current_phase,created_at,updated_at")
  .eq("workflow_version", "v2")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
if (runError) throw runError;

const { data: events, error: eventError } = await db
  .from("campaign_run_events")
  .select("event_type,phase,summary,details,created_at")
  .eq("campaign_run_id", run.id)
  .order("created_at", { ascending: false })
  .limit(8);
if (eventError) throw eventError;

const { data: discovery, error: discoveryError } = await db
  .from("discovery_runs_v2")
  .select("id,status")
  .eq("campaign_run_id", run.id)
  .maybeSingle();
if (discoveryError) throw discoveryError;

let counts = null;
if (discovery) {
  const { data: segments, error: segmentError } = await db
    .from("discovery_segment_runs_v2")
    .select("id")
    .eq("discovery_run_id", discovery.id);
  if (segmentError) throw segmentError;
  const segmentIds = (segments ?? []).map(({ id }) => id);
  const { data: executions, error: executionError } = segmentIds.length
    ? await db
        .from("discovery_provider_executions")
        .select("id")
        .in("discovery_segment_run_id", segmentIds)
    : { data: [], error: null };
  if (executionError) throw executionError;
  const executionIds = (executions ?? []).map(({ id }) => id);
  const { data: sources, error: sourceError } = executionIds.length
    ? await db
        .from("provider_source_records")
        .select("id,ingestion_status")
        .in("provider_execution_id", executionIds)
    : { data: [], error: null };
  if (sourceError) throw sourceError;
  const sourceIds = (sources ?? []).map(({ id }) => id);
  const { data: candidateRows, error: candidateError } = sourceIds.length
    ? await db
        .from("normalized_provider_candidates")
        .select("id,provider_source_record_id")
        .in("provider_source_record_id", sourceIds)
    : { data: [], error: null };
  if (candidateError) throw candidateError;
  const { data: referenceRows, error: referenceError } = sourceIds.length
    ? await db
        .from("organization_references_v2")
        .select("id,normalized_candidate_id,provider_source_record_id")
        .in("provider_source_record_id", sourceIds)
    : { data: [], error: null };
  if (referenceError) throw referenceError;
  const normalizedSourceIds = new Set(
    (sources ?? [])
      .filter(({ ingestion_status }) => ingestion_status === "normalized")
      .map(({ id }) => id),
  );
  const expectedIds = new Set(
    (candidateRows ?? [])
      .filter(({ provider_source_record_id }) =>
        normalizedSourceIds.has(provider_source_record_id),
      )
      .map(({ id }) => id),
  );
  const suppliedIds = new Set(
    (referenceRows ?? [])
      .filter(({ provider_source_record_id }) =>
        normalizedSourceIds.has(provider_source_record_id),
      )
      .map(({ normalized_candidate_id }) => normalized_candidate_id),
  );
  const sourceByCandidateId = new Map(
    (candidateRows ?? []).map(({ id, provider_source_record_id }) => [
      id,
      provider_source_record_id,
    ]),
  );
  const mismatchedSourcePairs = (referenceRows ?? []).filter(
    ({ normalized_candidate_id, provider_source_record_id }) =>
      normalizedSourceIds.has(provider_source_record_id) &&
      sourceByCandidateId.get(normalized_candidate_id) !== provider_source_record_id,
  ).length;
  counts = {
    candidates: (candidateRows ?? []).length,
    candidatesOnNormalizedSources: (candidateRows ?? []).filter(({ provider_source_record_id }) =>
      (sources ?? []).some(
        ({ id, ingestion_status }) =>
          id === provider_source_record_id && ingestion_status === "normalized",
      ),
    ).length,
    normalizedSources: (sources ?? []).filter(
      ({ ingestion_status }) => ingestion_status === "normalized",
    ).length,
    references: (referenceRows ?? []).length,
    sources: (sources ?? []).length,
    expectedNotSupplied: [...expectedIds].filter((id) => !suppliedIds.has(id)).length,
    suppliedNotExpected: [...suppliedIds].filter((id) => !expectedIds.has(id)).length,
    suppliedUniqueCandidates: suppliedIds.size,
    mismatchedSourcePairs,
  };
}

console.log(JSON.stringify({ run, discovery, counts, events }, null, 2));

function loadLocalEnv() {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [name, ...parts] = trimmed.split("=");
    if (!name || process.env[name]) continue;
    process.env[name] = parts.join("=").replace(/^['"]|['"]$/g, "");
  }
}
