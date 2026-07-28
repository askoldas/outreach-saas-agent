import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  resultLanes,
  type CampaignResultCandidate,
  type CampaignV2Results,
  type ResultLane,
} from "./types";

type RecordValue = Record<string, unknown>;

export async function getCampaignV2Results(
  workspaceId: string,
  campaignExternalId: string,
  requestedRunId?: string,
): Promise<CampaignV2Results | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .maybeSingle();
  if (campaignError)
    throw new Error(`Could not load V2 campaign results: ${campaignError.message}`);
  if (!campaign) return null;

  let runQuery = supabase
    .from("campaign_runs")
    .select("id,status,workflow_version")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("workflow_version", "v2");
  runQuery = requestedRunId
    ? runQuery.eq("id", requestedRunId)
    : runQuery.order("created_at", { ascending: false }).limit(1);
  const { data: runs, error: runError } = await runQuery;
  if (runError) throw new Error(`Could not load V2 Campaign Run: ${runError.message}`);
  const run = runs?.[0];
  if (!run) return null;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("candidate_rank_snapshots")
    .select("id,comparative_batch_ids_json")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", run.id)
    .maybeSingle();
  if (snapshotError)
    throw new Error(`Could not load V2 ranking: ${snapshotError.message}`);

  const { data: discoveryRun, error: discoveryError } = await supabase
    .from("discovery_runs_v2")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", run.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (discoveryError)
    throw new Error(`Could not load V2 discovery coverage: ${discoveryError.message}`);

  const [entriesResult, coverageResult, gapsResult, entityCasesResult] =
    await Promise.all([
      snapshot
        ? supabase
            .from("candidate_rank_entries")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("rank_snapshot_id", snapshot.id)
            .order("rank_overall")
        : Promise.resolve({ data: [], error: null }),
      discoveryRun
        ? supabase
            .from("discovery_coverage_snapshots_v2")
            .select("id,archetype_key,geography_key,status,confidence,reasons_json")
            .eq("workspace_id", workspaceId)
            .eq("discovery_run_id", discoveryRun.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      discoveryRun
        ? supabase
            .from("discovery_gaps_v2")
            .select("id,description,severity,status")
            .eq("workspace_id", workspaceId)
            .eq("discovery_run_id", discoveryRun.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("entity_resolution_cases")
        .select("id,status,opened_at")
        .eq("workspace_id", workspaceId)
        .eq("campaign_run_id", run.id)
        .order("opened_at", { ascending: false }),
    ]);
  const firstError =
    entriesResult.error ??
    coverageResult.error ??
    gapsResult.error ??
    entityCasesResult.error;
  if (firstError)
    throw new Error(`Could not load V2 result details: ${firstError.message}`);

  const entries = entriesResult.data ?? [];
  const candidateIds = entries.map((entry) => entry.campaign_candidate_id);
  const evaluationIds = entries.map((entry) => entry.candidate_evaluation_version_id);
  if (!candidateIds.length) {
    return {
      anomalies: [],
      candidates: [],
      coverage: (coverageResult.data ?? []).map((item) => ({
        archetype: item.archetype_key,
        confidence: item.confidence,
        geography: item.geography_key,
        reasons: stringArray(item.reasons_json),
        status: item.status,
      })),
      entityReviewCases:
        entityCasesResult.data?.map((item) => ({
          id: item.id,
          openedAt: item.opened_at,
          status: item.status,
        })) ?? [],
      gaps: gapsResult.data ?? [],
      laneCounts: emptyLaneCounts(),
      runId: run.id,
      runStatus: run.status,
    };
  }

  const [
    candidatesResult,
    evaluationsResult,
    relationshipsResult,
    factorsResult,
    scoresResult,
    confidenceResult,
    eligibilityResult,
    explanationsResult,
  ] = await Promise.all([
    supabase
      .from("campaign_candidates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", candidateIds),
    supabase
      .from("candidate_evaluation_versions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", evaluationIds),
    supabase
      .from("candidate_relationship_assessments")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
    supabase
      .from("candidate_factor_evaluations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
    supabase
      .from("candidate_score_calculations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
    supabase
      .from("candidate_confidence_calculations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
    supabase
      .from("candidate_eligibility_decisions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
    supabase
      .from("candidate_explanations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("candidate_evaluation_version_id", evaluationIds),
  ]);
  for (const result of [
    candidatesResult,
    evaluationsResult,
    relationshipsResult,
    factorsResult,
    scoresResult,
    confidenceResult,
    eligibilityResult,
    explanationsResult,
  ]) {
    if (result.error)
      throw new Error(`Could not load V2 candidate results: ${result.error.message}`);
  }

  const candidateRows = candidatesResult.data ?? [];
  const organizationIds = [
    ...new Set(
      candidateRows.flatMap((item) => [
        item.organization_id,
        item.display_organization_id,
      ]),
    ),
  ];
  const intelligenceIds = (evaluationsResult.data ?? []).map(
    (item) => item.candidate_intelligence_version_id,
  );
  const batchIds = stringArray(snapshot?.comparative_batch_ids_json ?? []);
  const [organizationsResult, domainsResult, intelligenceResult, anomalyResult] =
    await Promise.all([
      supabase
        .from("companies")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("id", organizationIds),
      supabase
        .from("company_domains")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("company_id", organizationIds),
      supabase
        .from("candidate_intelligence_versions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("id", intelligenceIds),
      batchIds.length
        ? supabase
            .from("comparative_anomalies")
            .select("*")
            .eq("workspace_id", workspaceId)
            .in("comparative_batch_id", batchIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  for (const result of [
    organizationsResult,
    domainsResult,
    intelligenceResult,
    anomalyResult,
  ]) {
    if (result.error)
      throw new Error(`Could not load V2 company intelligence: ${result.error.message}`);
  }

  // These WP-19 tables exist after migration 29. Keeping this read optional makes
  // an in-flight deployment display results while the migration is being applied.
  type ReviewQuery = {
    eq(column: string, value: string | boolean): ReviewQuery;
    in(
      column: string,
      values: string[],
    ): Promise<{
      data: RecordValue[] | null;
      error: { message: string } | null;
    }>;
  };
  const reviewClient = supabase as unknown as {
    from(table: string): {
      select(columns: string): ReviewQuery;
    };
  };
  const [reviewResult, correctionsResult] = await Promise.all([
    reviewClient
      .from("candidate_review_decisions_v2")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", run.id)
      .eq("is_current", true)
      .in("campaign_candidate_id", candidateIds),
    reviewClient
      .from("candidate_corrections_v2")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", run.id)
      .in("campaign_candidate_id", candidateIds),
  ]);

  const byId = <T extends { id: string }>(items: T[] | null) =>
    new Map((items ?? []).map((item) => [item.id, item]));
  const candidateById = byId(candidateRows);
  const evaluationById = byId(evaluationsResult.data);
  const organizationById = byId(organizationsResult.data);
  const intelligenceById = byId(intelligenceResult.data);
  const relationshipByEvaluation = new Map(
    (relationshipsResult.data ?? []).map((item) => [
      item.candidate_evaluation_version_id,
      item,
    ]),
  );
  const confidenceByEvaluation = new Map(
    (confidenceResult.data ?? []).map((item) => [
      item.candidate_evaluation_version_id,
      item,
    ]),
  );
  const eligibilityByEvaluation = new Map(
    (eligibilityResult.data ?? []).map((item) => [
      item.candidate_evaluation_version_id,
      item,
    ]),
  );
  const explanationByEvaluation = new Map(
    (explanationsResult.data ?? []).map((item) => [
      item.candidate_evaluation_version_id,
      item,
    ]),
  );
  const reviewByCandidate = new Map(
    (reviewResult.data ?? []).map((item) => [String(item.campaign_candidate_id), item]),
  );
  const correctionsByCandidate = groupBy(
    correctionsResult.data ?? [],
    "campaign_candidate_id",
  );
  const factorsByEvaluation = groupBy(
    factorsResult.data ?? [],
    "candidate_evaluation_version_id",
  );
  const scoresByEvaluation = groupBy(
    scoresResult.data ?? [],
    "candidate_evaluation_version_id",
  );
  const domainsByOrganization = groupBy(domainsResult.data ?? [], "company_id");

  const candidates = entries.flatMap((entry): CampaignResultCandidate[] => {
    const candidate = candidateById.get(entry.campaign_candidate_id);
    const evaluation = evaluationById.get(entry.candidate_evaluation_version_id);
    if (!candidate || !evaluation) return [];
    const organization =
      organizationById.get(candidate.display_organization_id) ??
      organizationById.get(candidate.organization_id);
    if (!organization) return [];
    const relationship = relationshipByEvaluation.get(evaluation.id);
    const confidence = confidenceByEvaluation.get(evaluation.id);
    const eligibility = eligibilityByEvaluation.get(evaluation.id);
    const explanation = explanationByEvaluation.get(evaluation.id);
    const intelligence = intelligenceById.get(
      evaluation.candidate_intelligence_version_id,
    );
    const scores = scoresByEvaluation.get(evaluation.id) ?? [];
    const factorRows = factorsByEvaluation.get(evaluation.id) ?? [];
    const primaryDomain =
      (domainsByOrganization.get(organization.id) ?? []).find(
        (item) => item.is_primary,
      ) ?? (domainsByOrganization.get(organization.id) ?? [])[0];
    const review = reviewByCandidate.get(candidate.id);
    const lane = normalizeLane(entry.lane);
    return [
      {
        archetypes: stringArray(candidate.matched_archetype_ids_json),
        candidateId: candidate.id,
        confidence: confidence?.overall_confidence ?? null,
        correctionCount: (correctionsByCandidate.get(candidate.id) ?? []).length,
        country: organization.country,
        domain: primaryDomain?.domain ?? null,
        eligibility: eligibility?.eligibility ?? "unknown",
        eligibilityReason: eligibility?.reason_text ?? "",
        evaluationId: evaluation.id,
        explanation: explanation?.summary ?? "No explanation was produced.",
        factors: factorRows.map((factor) => ({
          confidence: factor.confidence,
          explanation: factor.explanation,
          key: factor.factor_key,
          missingEvidence: stringArray(factor.missing_evidence_json),
          state: factor.state,
          value: factor.signed_value ?? factor.potential_value,
        })),
        fit: scoreValue(scores, "fit"),
        identityConfidence: organization.identity_confidence,
        identityReviewState: organization.identity_review_state,
        lane,
        location:
          [organization.city, organization.country].filter(Boolean).join(", ") ||
          "Unknown",
        name: organization.name,
        organizationType: organization.organization_type,
        potential: scoreValue(scores, "potential"),
        rank: entry.rank_overall,
        relationship: relationship?.primary_relationship ?? "unknown",
        relationshipConfidence: relationship?.confidence ?? null,
        reviewDecision: review ? String(review.decision) : null,
        reviewReason: review ? String(review.reason ?? "") : null,
        strongestEvidence: strongestEvidence(factorRows),
        unresolvedQuestions: stringArray(
          intelligence?.unresolved_question_keys_json ?? [],
        ),
        websiteUrl: organization.website_url,
      },
    ];
  });
  const laneCounts = emptyLaneCounts();
  for (const candidate of candidates) laneCounts[candidate.lane] += 1;

  return {
    anomalies: (anomalyResult.data ?? []).map((item) => ({
      blocking: item.blocks_finalization,
      explanation: item.explanation,
      id: item.id,
      recommendation: item.recommended_action,
      severity: item.severity,
    })),
    candidates,
    coverage: (coverageResult.data ?? []).map((item) => ({
      archetype: item.archetype_key,
      confidence: item.confidence,
      geography: item.geography_key,
      reasons: stringArray(item.reasons_json),
      status: item.status,
    })),
    entityReviewCases:
      entityCasesResult.data?.map((item) => ({
        id: item.id,
        openedAt: item.opened_at,
        status: item.status,
      })) ?? [],
    gaps: gapsResult.data ?? [],
    laneCounts,
    runId: run.id,
    runStatus: run.status,
  };
}

function emptyLaneCounts(): Record<ResultLane, number> {
  return Object.fromEntries(resultLanes.map((lane) => [lane, 0])) as Record<
    ResultLane,
    number
  >;
}

function groupBy<T extends RecordValue>(items: T[], key: keyof T) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const value = String(item[key]);
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function normalizeLane(value: string): ResultLane {
  const normalized = value.toLowerCase().replaceAll(" ", "_");
  if (resultLanes.includes(normalized as ResultLane)) return normalized as ResultLane;
  if (normalized === "needs_more_research") return "needs_research";
  if (normalized.includes("invalid") || normalized.includes("duplicate"))
    return "invalid_duplicate";
  return "conditional";
}

function scoreValue(
  rows: Array<{ score: number | null; score_type: string }>,
  type: string,
) {
  return rows.find((row) => row.score_type.toLowerCase().includes(type))?.score ?? null;
}

function strongestEvidence(
  rows: Array<{ evidence_quality: number; explanation: string }>,
) {
  return (
    [...rows].sort((left, right) => right.evidence_quality - left.evidence_quality)[0]
      ?.explanation ?? "No supporting evidence recorded."
  );
}

function stringArray(value: Json | unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
