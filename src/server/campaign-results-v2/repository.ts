import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { campaignStrategyV2Schema } from "@/lib/intelligence/campaign-strategy-v2";
import type { Json } from "@/types/database.types";
import {
  resultLanes,
  type CampaignResultCandidate,
  type CampaignV2Results,
  type ResultLane,
} from "./types";
import { resolveCandidateDisplayIdentity } from "./display-identity";

type RecordValue = Record<string, unknown>;

type UntypedQuery = {
  eq(column: string, value: string | boolean): UntypedQuery;
  in(
    column: string,
    values: string[],
  ): Promise<{
    data: RecordValue[] | null;
    error: { message: string } | null;
  }>;
};

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
    .select("id,status,strategy_version_id,workflow_version")
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

  const { data: strategyVersion, error: strategyError } = await supabase
    .from("campaign_strategy_versions")
    .select("strategy")
    .eq("workspace_id", workspaceId)
    .eq("id", run.strategy_version_id)
    .maybeSingle();
  if (strategyError)
    throw new Error(`Could not load V2 Campaign Strategy: ${strategyError.message}`);
  const labels = resultLabels(strategyVersion?.strategy);
  const { funnel, researchCycleId, researchOutcome } = await loadResearchFunnel({
    campaignId: campaign.id,
    campaignRunId: run.id,
    strategyVersionId: run.strategy_version_id,
    supabase,
    workspaceId,
  });

  const { data: snapshot, error: snapshotError } = await supabase
    .from("candidate_rank_snapshots")
    .select("id,comparative_batch_ids_json")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", run.id)
    .eq("research_cycle_id", researchCycleId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  if (snapshotError)
    throw new Error(`Could not load V2 ranking: ${snapshotError.message}`);

  const { data: discoveryRun, error: discoveryError } = await supabase
    .from("discovery_runs_v2")
    .select("id,discovery_plan_id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", run.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (discoveryError)
    throw new Error(`Could not load V2 discovery coverage: ${discoveryError.message}`);

  const { data: discoveryPlan, error: discoveryPlanError } = discoveryRun
    ? await supabase
        .from("discovery_plans_v2")
        .select("memory_snapshot_id")
        .eq("workspace_id", workspaceId)
        .eq("id", discoveryRun.discovery_plan_id)
        .maybeSingle()
    : { data: null, error: null };
  if (discoveryPlanError) {
    throw new Error(
      `Could not load V2 discovery plan provenance: ${discoveryPlanError.message}`,
    );
  }

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
      funnel,
      researchOutcome,
      appliedMemorySnapshotId: discoveryPlan?.memory_snapshot_id ?? null,
      anomalies: [],
      candidates: [],
      coverage: mapCoverage(coverageResult.data ?? [], labels),
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
  const artifactClient = supabase as unknown as {
    from(table: string): {
      select(columns: string): UntypedQuery;
    };
  };
  const relationshipAssessmentIds = (evaluationsResult.data ?? []).flatMap(
    (evaluation) => {
      const id = objectString(
        evaluation,
        "commercial_relationship_assessment_version_id",
      );
      return id ? [id] : [];
    },
  );
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
  const [
    organizationsResult,
    domainsResult,
    intelligenceResult,
    relationshipArtifactsResult,
    anomalyResult,
  ] = await Promise.all([
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
    relationshipAssessmentIds.length
      ? artifactClient
          .from("commercial_relationship_assessment_versions_v2")
          .select(
            "id,company_intelligence_version_id,campaign_target_model_version_id,assessment_json",
          )
          .eq("workspace_id", workspaceId)
          .in("id", relationshipAssessmentIds)
      : Promise.resolve({ data: [], error: null }),
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
    relationshipArtifactsResult,
    anomalyResult,
  ]) {
    if (result.error)
      throw new Error(`Could not load V2 company intelligence: ${result.error.message}`);
  }

  const normalizedCandidateIds = [
    ...new Set(
      (organizationsResult.data ?? []).flatMap((organization) => {
        const id = objectString(organization.metadata, "normalizedCandidateId");
        return id ? [id] : [];
      }),
    ),
  ];
  const emptyUuid = "00000000-0000-0000-0000-000000000000";
  const normalizedCandidatesResult = await supabase
    .from("normalized_provider_candidates")
    .select("id,canonical_domain_hint,provider_source_record_id,source_url")
    .eq("workspace_id", workspaceId)
    .in("id", normalizedCandidateIds.length ? normalizedCandidateIds : [emptyUuid]);
  if (normalizedCandidatesResult.error) {
    throw new Error(
      `Could not load V2 candidate provenance: ${normalizedCandidatesResult.error.message}`,
    );
  }
  const providerSourceRecordIds = (normalizedCandidatesResult.data ?? []).map(
    (candidate) => candidate.provider_source_record_id,
  );
  const sourceRecordsResult = await supabase
    .from("provider_source_records")
    .select(
      "id,provider_execution_id,provider_key,query_or_filter_fingerprint,raw_payload_json,source_type,source_url",
    )
    .eq("workspace_id", workspaceId)
    .in("id", providerSourceRecordIds.length ? providerSourceRecordIds : [emptyUuid]);
  if (sourceRecordsResult.error) {
    throw new Error(
      `Could not load V2 candidate source records: ${sourceRecordsResult.error.message}`,
    );
  }
  const executionIds = [
    ...new Set((sourceRecordsResult.data ?? []).map((row) => row.provider_execution_id)),
  ];
  const discoveryQueriesResult = await supabase
    .from("discovery_queries_v2")
    .select("provider_execution_id,fingerprint,purpose,query_text")
    .eq("workspace_id", workspaceId)
    .in("provider_execution_id", executionIds.length ? executionIds : [emptyUuid]);
  if (discoveryQueriesResult.error) {
    throw new Error(
      `Could not load V2 discovery query provenance: ${discoveryQueriesResult.error.message}`,
    );
  }

  // These WP-19 tables exist after migration 29. Keeping this read optional makes
  // an in-flight deployment display results while the migration is being applied.
  const [reviewResult, correctionsResult] = await Promise.all([
    artifactClient
      .from("candidate_review_decisions_v2")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", run.id)
      .eq("is_current", true)
      .in("campaign_candidate_id", candidateIds),
    artifactClient
      .from("candidate_corrections_v2")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", run.id)
      .in("campaign_candidate_id", candidateIds),
  ]);
  const preclassificationResult = await artifactClient
    .from("provider_candidate_preclassifications_v2")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .in(
      "provider_source_record_id",
      providerSourceRecordIds.length ? providerSourceRecordIds : [emptyUuid],
    );

  const byId = <T extends { id: string }>(items: T[] | null) =>
    new Map((items ?? []).map((item) => [item.id, item]));
  const candidateById = byId(candidateRows);
  const evaluationById = byId(evaluationsResult.data);
  const organizationById = byId(organizationsResult.data);
  const intelligenceById = byId(intelligenceResult.data);
  const relationshipArtifactById = new Map(
    (relationshipArtifactsResult.data ?? []).flatMap((item) => {
      const id = objectString(item, "id");
      return id ? [[id, item] as const] : [];
    }),
  );
  const normalizedCandidateById = byId(normalizedCandidatesResult.data);
  const sourceRecordById = byId(sourceRecordsResult.data);
  const queryByFingerprint = new Map(
    (discoveryQueriesResult.data ?? []).map((item) => [
      `${item.provider_execution_id}:${item.fingerprint}`,
      item,
    ]),
  );
  const preclassificationBySource = new Map(
    (preclassificationResult.data ?? []).map((item) => [
      String(item.provider_source_record_id),
      item,
    ]),
  );
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
    const relationshipAssessmentVersionId = objectString(
      evaluation,
      "commercial_relationship_assessment_version_id",
    );
    const relationshipArtifact = relationshipAssessmentVersionId
      ? relationshipArtifactById.get(relationshipAssessmentVersionId)
      : undefined;
    const scores = scoresByEvaluation.get(evaluation.id) ?? [];
    const factorRows = factorsByEvaluation.get(evaluation.id) ?? [];
    const primaryDomain =
      (domainsByOrganization.get(organization.id) ?? []).find(
        (item) => item.is_primary,
      ) ?? (domainsByOrganization.get(organization.id) ?? [])[0];
    const normalizedCandidateId = objectString(
      organization.metadata,
      "normalizedCandidateId",
    );
    const normalizedCandidate = normalizedCandidateId
      ? normalizedCandidateById.get(normalizedCandidateId)
      : undefined;
    const sourceRecord = normalizedCandidate
      ? sourceRecordById.get(normalizedCandidate.provider_source_record_id)
      : undefined;
    const displayIdentity = resolveCandidateDisplayIdentity({
      canonicalDomainHint: normalizedCandidate?.canonical_domain_hint ?? null,
      organizationDomain: primaryDomain?.domain ?? null,
      organizationName: organization.name,
      organizationWebsiteUrl: organization.website_url,
      sourceTitle: objectString(sourceRecord?.raw_payload_json, "title"),
      sourceUrl: sourceRecord?.source_url ?? normalizedCandidate?.source_url ?? null,
    });
    const discoveryQuery = sourceRecord
      ? queryByFingerprint.get(
          `${sourceRecord.provider_execution_id}:${sourceRecord.query_or_filter_fingerprint}`,
        )
      : undefined;
    const preclassification = sourceRecord
      ? preclassificationBySource.get(sourceRecord.id)
      : undefined;
    const review = reviewByCandidate.get(candidate.id);
    const relationshipCorrectionProposals = (
      correctionsByCandidate.get(candidate.id) ?? []
    )
      .flatMap((correction) => {
        if (correction.correction_type !== "relationship") return [];
        const dimension = objectString(correction, "relationship_dimension");
        const sourceRelationshipAssessmentVersionId = objectString(
          correction,
          "source_relationship_assessment_version_id",
        );
        const proposedValue = objectString(correction.proposed_value_json, "value");
        if (!dimension || !sourceRelationshipAssessmentVersionId || !proposedValue) {
          return [];
        }
        return [
          {
            createdAt: String(correction.created_at),
            dimension,
            id: String(correction.id),
            proposedValue,
            reason: String(correction.reason),
            sourceRelationshipAssessmentVersionId,
            status: String(correction.status),
          },
        ];
      })
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      );
    const lane = normalizeLane(entry.lane);
    return [
      {
        archetypes: [
          ...new Set(
            stringArray(candidate.matched_archetype_ids_json).map((value) =>
              archetypeLabel(value, labels),
            ),
          ),
        ],
        artifactVersions: {
          campaignTargetModelVersionId: objectString(
            relationshipArtifact,
            "campaign_target_model_version_id",
          ),
          candidateIntelligenceVersionId: evaluation.candidate_intelligence_version_id,
          commercialRelationshipAssessmentVersionId: relationshipAssessmentVersionId,
          companyIntelligenceVersionId:
            objectString(evaluation, "company_intelligence_version_id") ??
            objectString(relationshipArtifact, "company_intelligence_version_id"),
          qualificationEvaluationVersionId: evaluation.id,
        },
        candidateId: candidate.id,
        confidence: confidence?.overall_confidence ?? null,
        correctionCount: (correctionsByCandidate.get(candidate.id) ?? []).length,
        country: organization.country,
        domain: displayIdentity.domain,
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
        name: displayIdentity.name,
        organizationType: organization.organization_type,
        potential: scoreValue(scores, "potential"),
        provenance: {
          discoveryPurpose: discoveryQuery?.purpose ?? null,
          discoveryQuery: discoveryQuery?.query_text ?? null,
          firstParty: isFirstPartySource(
            displayIdentity.domain,
            displayIdentity.sourceUrl,
          ),
          preclassificationConfidence: preclassification
            ? Number(preclassification.confidence)
            : null,
          preclassificationDisposition: preclassification
            ? String(preclassification.disposition)
            : null,
          preclassificationReasons: preclassification
            ? stringArray(preclassification.reason_codes_json)
            : [],
          provider: sourceRecord?.provider_key ?? null,
          sourceTitle: objectString(sourceRecord?.raw_payload_json, "title"),
          sourceType: sourceRecord?.source_type ?? null,
        },
        rank: entry.rank_overall,
        relationship: displayEnum(relationship?.primary_relationship ?? "unknown"),
        relationshipConfidence: relationship?.confidence ?? null,
        relationshipCorrectionProposals,
        relationshipDimensions: relationshipDimensions(
          relationshipArtifact?.assessment_json,
        ),
        reviewDecision: review ? String(review.decision) : null,
        reviewReason: review ? String(review.reason ?? "") : null,
        sourceUrl: displayIdentity.sourceUrl,
        strongestEvidence: strongestEvidence(factorRows),
        unresolvedQuestions: stringArray(
          intelligence?.unresolved_question_keys_json ?? [],
        ),
        websiteUrl: displayIdentity.websiteUrl,
      },
    ];
  });
  const laneCounts = emptyLaneCounts();
  for (const candidate of candidates) laneCounts[candidate.lane] += 1;

  return {
    funnel,
    researchOutcome,
    appliedMemorySnapshotId: discoveryPlan?.memory_snapshot_id ?? null,
    anomalies: (anomalyResult.data ?? []).map((item) => ({
      blocking: item.blocks_finalization,
      explanation: item.explanation,
      id: item.id,
      recommendation: item.recommended_action,
      severity: item.severity,
    })),
    candidates,
    coverage: mapCoverage(coverageResult.data ?? [], labels),
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

async function loadResearchFunnel(input: {
  campaignId: string;
  campaignRunId: string;
  strategyVersionId: string;
  supabase: Awaited<ReturnType<typeof createAuthenticatedDatabaseClient>>["supabase"];
  workspaceId: string;
}) {
  const { supabase } = input;
  const cycle = await supabase
    .from("campaign_research_cycles_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cycle.error)
    throw new Error(`Could not load research cycle: ${cycle.error.message}`);
  const discoveryRun = await supabase
    .from("discovery_runs_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (discoveryRun.error)
    throw new Error(`Could not load funnel Discovery run: ${discoveryRun.error.message}`);
  const segmentRuns = discoveryRun.data
    ? await supabase
        .from("discovery_segment_runs_v2")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .eq("discovery_run_id", discoveryRun.data.id)
    : { data: [], error: null };
  if (segmentRuns.error)
    throw new Error(`Could not load funnel segment runs: ${segmentRuns.error.message}`);
  const segmentRunIds = (segmentRuns.data ?? []).map(({ id }) => id);
  const [executions, references, candidates, research] = await Promise.all([
    supabase
      .from("discovery_provider_executions")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .in(
        "discovery_segment_run_id",
        segmentRunIds.length ? segmentRunIds : ["00000000-0000-0000-0000-000000000000"],
      ),
    supabase
      .from("discovery_source_organization_references_v2")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", input.campaignId),
    supabase
      .from("campaign_candidates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", input.campaignId)
      .eq("campaign_strategy_version_id", input.strategyVersionId),
    supabase
      .from("candidate_research_batches_v2")
      .select("completed_count")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .eq("research_cycle_id", cycle.data?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle(),
  ]);
  for (const result of [executions, references, candidates, research]) {
    if (result.error)
      throw new Error(`Could not load research funnel: ${result.error.message}`);
  }
  const executionIds = (executions.data ?? []).map(({ id }) => id);
  const records = executionIds.length
    ? await supabase
        .from("provider_source_records")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .in("provider_execution_id", executionIds)
    : { count: 0, error: null };
  if (records.error)
    throw new Error(`Could not count source records: ${records.error.message}`);
  const decision = cycle.data
    ? await supabase
        .from("campaign_research_cycle_decisions_v2")
        .select("action,rationale,decision_json")
        .eq("workspace_id", input.workspaceId)
        .eq("research_cycle_id", cycle.data.id)
        .order("decision_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (decision.error)
    throw new Error(`Could not load research outcome: ${decision.error.message}`);
  const decisionJson = (decision.data?.decision_json ?? {}) as Record<string, Json>;
  const uniqueOrganizations = candidates.count ?? 0;
  return {
    funnel: {
      sourceRecords: records.count ?? 0,
      organizationReferences: references.count ?? 0,
      uniqueOrganizations,
      plausibleCandidates: uniqueOrganizations,
      deeplyResearched: research.data?.completed_count ?? 0,
    },
    researchCycleId: cycle.data?.id ?? null,
    researchOutcome: decision.data
      ? {
          action: decision.data.action,
          rationale: decision.data.rationale,
          additionalOpportunityRemains:
            decisionJson.additionalOpportunityRemains === true,
        }
      : null,
  };
}

function isFirstPartySource(domain: string | null, sourceUrl: string | null) {
  if (!domain || !sourceUrl) return false;
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    const normalizedDomain = domain.replace(/^www\./, "").toLowerCase();
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  } catch {
    return false;
  }
}

type ResultLabels = {
  archetypes: Map<string, string>;
  geographies: Map<string, string>;
};

function resultLabels(value: Json | undefined): ResultLabels {
  const labels: ResultLabels = {
    archetypes: new Map(),
    geographies: new Map(),
  };
  const parsed = campaignStrategyV2Schema.safeParse(value);
  if (!parsed.success) return labels;

  for (const archetype of parsed.data.archetypes) {
    labels.archetypes.set(archetype.id, archetype.label);
  }
  const geographies = [
    parsed.data.geography,
    ...parsed.data.discoverySegments.map((segment) => segment.geography),
  ];
  for (const geography of geographies) {
    labels.geographies.set(
      [...geography.countryCodes].sort().join("+"),
      geography.displayName,
    );
  }
  return labels;
}

function mapCoverage(
  rows: Array<{
    archetype_key: string;
    confidence: number;
    geography_key: string;
    id: string;
    reasons_json: Json;
    status: string;
  }>,
  labels: ResultLabels,
): CampaignV2Results["coverage"] {
  const seen = new Set<string>();
  return rows.flatMap((item) => {
    const identity = `${item.archetype_key}:${item.geography_key}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [
      {
        archetype: archetypeLabel(item.archetype_key, labels),
        confidence: item.confidence,
        geography: geographyLabel(item.geography_key, labels),
        id: item.id,
        reasons: stringArray(item.reasons_json),
        status: displayEnum(item.status),
      },
    ];
  });
}

function archetypeLabel(value: string, labels: ResultLabels) {
  const configured = labels.archetypes.get(value);
  if (configured) return configured;
  const semanticKey = value.includes(".archetype.")
    ? (value.split(".archetype.").at(-1) ?? value)
    : value;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(semanticKey)) return "Target company";
  return humanizeKey(semanticKey);
}

function geographyLabel(value: string, labels: ResultLabels) {
  const configured = labels.geographies.get(value);
  if (configured) return configured;
  const countryCodes = value.split("+");
  if (countryCodes.length && countryCodes.every((code) => /^[A-Z]{2}$/.test(code))) {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return countryCodes.map((code) => names.of(code) ?? code).join(", ");
  }
  return humanizeKey(value);
}

function displayEnum(value: string) {
  return value === "unknown" ? "Not established" : humanizeKey(value);
}

function humanizeKey(value: string) {
  const words = value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Not established";
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

function objectString(value: Json | unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function relationshipDimensions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const relationships = (value as RecordValue).relationships;
  if (
    !relationships ||
    typeof relationships !== "object" ||
    Array.isArray(relationships)
  ) {
    return [];
  }
  return Object.entries(relationships as RecordValue)
    .flatMap(([type, dimension]) => {
      if (!dimension || typeof dimension !== "object" || Array.isArray(dimension)) {
        return [];
      }
      const record = dimension as RecordValue;
      const confidence = record.confidence;
      const rationale = record.rationale;
      const state = record.state;
      if (
        typeof confidence !== "number" ||
        typeof rationale !== "string" ||
        typeof state !== "string"
      ) {
        return [];
      }
      return [
        {
          confidence,
          counterEvidenceIds: stringArray(record.counterEvidenceIds),
          evidenceIds: stringArray(record.evidenceIds),
          rationale,
          state,
          type,
          unresolvedQuestions: stringArray(record.unresolvedQuestions),
        },
      ];
    })
    .sort((left, right) => left.type.localeCompare(right.type));
}
