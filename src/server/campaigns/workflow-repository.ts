import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { MarketAnalysis } from "@/lib/campaign-workflow/market-planning";
import {
  campaignStrategyV2Schema,
  type CampaignStrategyV2,
} from "@/lib/intelligence/campaign-strategy-v2";

export type CampaignWorkflowSummary = {
  selectedRunId: string | null;
  selectedRunIsLatest: boolean;
  runEvents: Array<{
    id: string;
    eventType: string;
    phase: string | null;
    level: string;
    summary: string;
    createdAt: string;
  }>;
  runHistory: Array<{
    id: string;
    status: string;
    phase: string;
    iteration: number;
    candidatesDiscovered: number;
    candidatesClassified: number;
    companiesEvaluated: number;
    companiesQualified: number;
    totalCost: number;
    currency: string;
    createdAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    errorMessage: string | null;
  }>;
  candidateAudit: Array<{
    id: string;
    companyName: string;
    normalizedDomain: string | null;
    sourceUrl: string;
    sourceType: string;
    sourceQuery: string;
    sourcePath: string;
    snippet: string;
    countryRegion: string | null;
    probableCategory: string | null;
    discoveryConfidence: number | null;
    retrievedAt: string;
    classification: {
      status: string;
      confidence: number;
      geographyMatch: boolean | null;
      shouldEvaluate: boolean;
      reason: string;
      modelRole: string | null;
      promptVersion: string | null;
    } | null;
  }>;
  latestRun: {
    id: string;
    status: string;
    phase: string;
    iteration: number;
    progress: number;
    llmCost: number;
    providerCost: number;
    totalCost: number;
    currency: string;
    errorCode: string | null;
    errorMessage: string | null;
  } | null;
  marketAnalysis: MarketAnalysis | null;
  v2Strategy: {
    summary: string;
    objective: string;
    objectiveDescription: string;
    geography: string;
    countryCodes: string[];
    localLanguages: string[];
    workingLanguages: string[];
    archetypes: Array<{
      id: string;
      label: string;
      relationshipType: string;
      rationale: string;
    }>;
    segments: Array<{
      id: string;
      label: string;
      geography: string;
      targetCandidateCount: number;
    }>;
  } | null;
  v2Discovery: {
    planId: string;
    planStatus: string;
    runStatus: string | null;
    stoppingReason: string | null;
    providerCalls: number;
    providerRecords: number;
    normalizedCandidates: number;
    uniqueCandidates: number;
    coverageSummary: Record<string, unknown>;
    continuationDecision: Record<string, unknown> | null;
    segments: Array<{
      id: string;
      label: string;
      geography: string;
      status: string;
      targetCandidateCount: number;
      passCount: number;
      providerRecords: number;
      normalizedCandidates: number;
      uniqueCandidates: number;
    }>;
    queries: Array<{
      id: string;
      query: string;
      family: string;
      language: string;
      country: string | null;
      purpose: string;
    }>;
  } | null;
  discoveryPaths: Array<{
    id: string;
    type: string;
    rationale: string;
    expectedCompanyCategory: string;
    queries: string[];
    expectedYield: string | null;
  }>;
  classificationCounts: Record<string, number>;
  excludedCandidates: Array<{
    id: string;
    companyName: string;
    sourceUrl: string;
    status: string;
    reason: string;
  }>;
  iterations: Array<{
    iterationNumber: number;
    decision: string | null;
    decisionReason: string | null;
    metrics: Record<string, unknown>;
  }>;
};

export async function getCampaignWorkflowSummary(
  workspaceId: string,
  campaignExternalId: string,
  selectedRunId?: string,
): Promise<CampaignWorkflowSummary> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,workflow_version,current_strategy_version_id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignExternalId)
    .single();
  if (campaignError)
    throw new Error(`Could not load campaign workflow: ${campaignError.message}`);
  const { data: runs, error: runError } = await supabase
    .from("campaign_runs")
    .select(
      "id,status,current_phase,current_iteration,progress_percentage,candidates_discovered,candidates_classified,companies_evaluated,companies_qualified,llm_cost,provider_cost,total_cost,currency,error_code,error_message,created_at,completed_at,cancelled_at,strategy_version_id,workflow_version",
    )
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (runError) throw new Error(`Could not load campaign run: ${runError.message}`);
  const run = runs?.[0];
  if (!run)
    return {
      selectedRunId: null,
      selectedRunIsLatest: true,
      runEvents: [],
      runHistory: [],
      candidateAudit: [],
      latestRun: null,
      marketAnalysis: null,
      v2Strategy: await loadV2StrategySummary({
        supabase,
        workspaceId,
        campaignId: campaign.id,
        strategyVersionId: campaign.current_strategy_version_id,
      }),
      v2Discovery: null,
      discoveryPaths: [],
      classificationCounts: {},
      excludedCandidates: [],
      iterations: [],
    };
  const selectedRun = selectedRunId
    ? runs.find((item) => item.id === selectedRunId)
    : run;
  if (!selectedRun) {
    throw new Error("The selected Campaign Run was not found in this workspace.");
  }
  const v2Strategy =
    campaign.workflow_version === "v2" || selectedRun.workflow_version === "v2"
      ? await loadV2StrategySummary({
          supabase,
          workspaceId,
          campaignId: campaign.id,
          strategyVersionId:
            selectedRun.strategy_version_id || campaign.current_strategy_version_id,
        })
      : null;
  const v2Discovery =
    campaign.workflow_version === "v2" || selectedRun.workflow_version === "v2"
      ? await loadV2DiscoverySummary({
          supabase,
          workspaceId,
          campaignId: campaign.id,
          campaignRunId: selectedRun.id,
          strategy: v2Strategy,
        })
      : null;

  const [
    { data: analysis },
    { data: plan },
    { data: classifications },
    { data: iterations },
    { data: candidates },
    { data: runEvents },
  ] = await Promise.all([
    supabase
      .from("market_analyses")
      .select("analysis")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("discovery_plans")
      .select(
        "id,discovery_paths(id,path_type,rationale,expected_company_category,queries,expected_yield,priority)",
      )
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("candidate_classifications")
      .select(
        "id,candidate_id,status,confidence,geography_match,should_evaluate,exclusion_reason,reasons,model_role,prompt_version,created_at,candidate:discovery_candidates!inner(company_name,source_url)",
      )
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("discovery_iterations")
      .select("iteration_number,decision,decision_reason,metrics")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .order("iteration_number"),
    supabase
      .from("discovery_candidates")
      .select(
        "id,company_name,normalized_domain,source_url,source_type,source_query,source_path,snippet,country_region,probable_category,discovery_confidence,retrieved_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .order("retrieved_at", { ascending: false })
      .limit(100),
    supabase
      .from("campaign_run_events")
      .select("id,event_type,phase,level,summary,created_at")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", selectedRun.id)
      .eq("visible_to_user", true)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const counts: Record<string, number> = {};
  for (const row of classifications ?? [])
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  const classificationByCandidate = new Map<
    string,
    NonNullable<typeof classifications>[number]
  >();
  for (const classification of classifications ?? []) {
    if (!classificationByCandidate.has(classification.candidate_id)) {
      classificationByCandidate.set(classification.candidate_id, classification);
    }
  }
  const paths = (plan?.discovery_paths ?? []) as Array<{
    id: string;
    path_type: string;
    rationale: string;
    expected_company_category: string;
    queries: string[];
    expected_yield: string | null;
    priority: number;
  }>;
  return {
    selectedRunId: selectedRun.id,
    selectedRunIsLatest: selectedRun.id === run.id,
    runEvents: (runEvents ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      phase: event.phase,
      level: event.level,
      summary: event.summary,
      createdAt: event.created_at,
    })),
    runHistory: runs.map((item) => ({
      id: item.id,
      status: item.status,
      phase: item.current_phase,
      iteration: item.current_iteration,
      candidatesDiscovered: item.candidates_discovered,
      candidatesClassified: item.candidates_classified,
      companiesEvaluated: item.companies_evaluated,
      companiesQualified: item.companies_qualified,
      totalCost: numeric(item.total_cost),
      currency: item.currency,
      createdAt: item.created_at,
      completedAt: item.completed_at,
      cancelledAt: item.cancelled_at,
      errorMessage: item.error_message,
    })),
    candidateAudit: (candidates ?? []).map((candidate) => {
      const classification = classificationByCandidate.get(candidate.id);
      return {
        id: candidate.id,
        companyName: candidate.company_name,
        normalizedDomain: candidate.normalized_domain,
        sourceUrl: candidate.source_url,
        sourceType: candidate.source_type,
        sourceQuery: candidate.source_query,
        sourcePath: candidate.source_path,
        snippet: candidate.snippet,
        countryRegion: candidate.country_region,
        probableCategory: candidate.probable_category,
        discoveryConfidence:
          candidate.discovery_confidence === null
            ? null
            : numeric(candidate.discovery_confidence),
        retrievedAt: candidate.retrieved_at,
        classification: classification
          ? {
              status: classification.status,
              confidence: numeric(classification.confidence),
              geographyMatch: classification.geography_match,
              shouldEvaluate: classification.should_evaluate,
              reason:
                classification.exclusion_reason ||
                classification.reasons?.join("; ") ||
                "No concise classification rationale was recorded.",
              modelRole: classification.model_role,
              promptVersion: classification.prompt_version,
            }
          : null,
      };
    }),
    latestRun: {
      id: selectedRun.id,
      status: selectedRun.status,
      phase: selectedRun.current_phase,
      iteration: selectedRun.current_iteration,
      progress: selectedRun.progress_percentage,
      llmCost: numeric(selectedRun.llm_cost),
      providerCost: numeric(selectedRun.provider_cost),
      totalCost: numeric(selectedRun.total_cost),
      currency: selectedRun.currency,
      errorCode: selectedRun.error_code,
      errorMessage: selectedRun.error_message,
    },
    marketAnalysis: (analysis?.analysis as MarketAnalysis | undefined) ?? null,
    v2Strategy,
    v2Discovery,
    discoveryPaths: paths
      .sort((a, b) => a.priority - b.priority)
      .map((path) => ({
        id: path.id,
        type: path.path_type,
        rationale: path.rationale,
        expectedCompanyCategory: path.expected_company_category,
        queries: path.queries,
        expectedYield: path.expected_yield,
      })),
    classificationCounts: counts,
    excludedCandidates: (classifications ?? [])
      .filter((classification) =>
        ["excluded", "unlikely", "duplicate", "insufficient_data"].includes(
          classification.status,
        ),
      )
      .slice(0, 50)
      .map((classification) => {
        const candidate = classification.candidate as unknown as {
          company_name: string;
          source_url: string;
        };
        return {
          id: classification.id,
          companyName: candidate.company_name,
          sourceUrl: candidate.source_url,
          status: classification.status,
          reason:
            classification.exclusion_reason ||
            classification.reasons?.join("; ") ||
            "No evaluation evidence was available.",
        };
      }),
    iterations: (iterations ?? []).map((iteration) => ({
      iterationNumber: iteration.iteration_number,
      decision: iteration.decision,
      decisionReason: iteration.decision_reason,
      metrics: (iteration.metrics as Record<string, unknown>) ?? {},
    })),
  };
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type AuthenticatedSupabase = Awaited<
  ReturnType<typeof createAuthenticatedDatabaseClient>
>["supabase"];

async function loadV2StrategySummary(input: {
  supabase: AuthenticatedSupabase;
  workspaceId: string;
  campaignId: string;
  strategyVersionId: string | null;
}): Promise<CampaignWorkflowSummary["v2Strategy"]> {
  if (!input.strategyVersionId) return null;
  const { data, error } = await input.supabase
    .from("campaign_strategy_versions")
    .select("strategy")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("id", input.strategyVersionId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Campaign Strategy V2: ${error.message}`);
  if (!data) return null;
  const strategy = campaignStrategyV2Schema.parse(data.strategy);
  return summarizeV2Strategy(strategy);
}

function summarizeV2Strategy(
  strategy: CampaignStrategyV2,
): NonNullable<CampaignWorkflowSummary["v2Strategy"]> {
  return {
    summary: strategy.strategySummary,
    objective: strategy.objective.label,
    objectiveDescription: strategy.objective.description,
    geography: strategy.geography.displayName,
    countryCodes: [...strategy.geography.countryCodes],
    localLanguages: [...strategy.geography.localLanguages],
    workingLanguages: [...strategy.geography.workingLanguages],
    archetypes: strategy.archetypes.map((archetype) => ({
      id: archetype.id,
      label: archetype.label,
      relationshipType: archetype.relationshipType,
      rationale: archetype.commercialRationale,
    })),
    segments: strategy.discoverySegments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      geography: segment.geography.displayName,
      targetCandidateCount: segment.targetCandidateCount ?? 0,
    })),
  };
}

async function loadV2DiscoverySummary(input: {
  supabase: AuthenticatedSupabase;
  workspaceId: string;
  campaignId: string;
  campaignRunId: string;
  strategy: CampaignWorkflowSummary["v2Strategy"];
}): Promise<CampaignWorkflowSummary["v2Discovery"]> {
  const { data: plan, error: planError } = await input.supabase
    .from("discovery_plans_v2")
    .select("id,status")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("campaign_run_id", input.campaignRunId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError)
    throw new Error(`Could not load Semantic Discovery plan: ${planError.message}`);
  if (!plan) return null;
  const [segmentsResult, runResult] = await Promise.all([
    input.supabase
      .from("discovery_segments_v2")
      .select("id,segment_key,status,target_candidate_count,geography_json")
      .eq("workspace_id", input.workspaceId)
      .eq("discovery_plan_id", plan.id)
      .order("priority"),
    input.supabase
      .from("discovery_runs_v2")
      .select(
        "id,status,stopping_reason,coverage_summary_json,continuation_decision_json",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("discovery_plan_id", plan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (segmentsResult.error)
    throw new Error(
      `Could not load Semantic Discovery segments: ${segmentsResult.error.message}`,
    );
  if (runResult.error)
    throw new Error(`Could not load Semantic Discovery run: ${runResult.error.message}`);
  const segmentRows = segmentsResult.data ?? [];
  const discoveryRun = runResult.data;
  const segmentRunResult = discoveryRun
    ? await input.supabase
        .from("discovery_segment_runs_v2")
        .select(
          "id,discovery_segment_id,status,pass_number,provider_record_count,normalized_candidate_count,unique_candidate_count",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("discovery_run_id", discoveryRun.id)
        .order("pass_number")
    : { data: [], error: null };
  if (segmentRunResult.error)
    throw new Error(
      `Could not load Semantic Discovery passes: ${segmentRunResult.error.message}`,
    );
  const segmentRuns = segmentRunResult.data ?? [];
  const segmentRunIds = segmentRuns.map(({ id }) => id);
  const queryPlanResult = segmentRunIds.length
    ? await input.supabase
        .from("discovery_query_plans_v2")
        .select("id,discovery_segment_run_id,queries_json")
        .eq("workspace_id", input.workspaceId)
        .in("discovery_segment_run_id", segmentRunIds)
        .order("created_at")
    : { data: [], error: null };
  if (queryPlanResult.error)
    throw new Error(
      `Could not load Semantic Discovery queries: ${queryPlanResult.error.message}`,
    );
  const strategySegmentById = new Map(
    (input.strategy?.segments ?? []).map((segment) => [segment.id, segment] as const),
  );
  const runsBySegment = new Map<string, typeof segmentRuns>();
  for (const segmentRun of segmentRuns) {
    const current = runsBySegment.get(segmentRun.discovery_segment_id) ?? [];
    current.push(segmentRun);
    runsBySegment.set(segmentRun.discovery_segment_id, current);
  }
  const queries = (queryPlanResult.data ?? []).flatMap((queryPlan) =>
    jsonArray(queryPlan.queries_json).map((query, index) => ({
      id: stringField(query, "id") || `${queryPlan.id}:${index}`,
      query: stringField(query, "query") || stringField(query, "queryText"),
      family: stringField(query, "family") || "web_search",
      language: stringField(query, "language") || "Unknown",
      country: stringField(query, "country") || null,
      purpose: stringField(query, "purpose") || "Candidate discovery",
    })),
  );
  return {
    planId: plan.id,
    planStatus: plan.status,
    runStatus: discoveryRun?.status ?? null,
    stoppingReason: discoveryRun?.stopping_reason ?? null,
    providerCalls: queries.length,
    providerRecords: segmentRuns.reduce(
      (total, run) => total + run.provider_record_count,
      0,
    ),
    normalizedCandidates: segmentRuns.reduce(
      (total, run) => total + run.normalized_candidate_count,
      0,
    ),
    uniqueCandidates: segmentRuns.reduce(
      (total, run) => total + run.unique_candidate_count,
      0,
    ),
    coverageSummary: objectValue(discoveryRun?.coverage_summary_json),
    continuationDecision: nullableObjectValue(discoveryRun?.continuation_decision_json),
    segments: segmentRows.map((segment) => {
      const runs = runsBySegment.get(segment.id) ?? [];
      const frozen = strategySegmentById.get(segment.segment_key);
      const geography = objectValue(segment.geography_json);
      return {
        id: segment.id,
        label: frozen?.label ?? segment.segment_key,
        geography:
          frozen?.geography ?? (stringField(geography, "displayName") || "Not specified"),
        status: runs.at(-1)?.status ?? segment.status,
        targetCandidateCount:
          segment.target_candidate_count ?? frozen?.targetCandidateCount ?? 0,
        passCount: runs.length,
        providerRecords: runs.reduce(
          (total, run) => total + run.provider_record_count,
          0,
        ),
        normalizedCandidates: runs.reduce(
          (total, run) => total + run.normalized_candidate_count,
          0,
        ),
        uniqueCandidates: runs.reduce(
          (total, run) => total + run.unique_candidate_count,
          0,
        ),
      };
    }),
    queries,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nullableObjectValue(value: unknown): Record<string, unknown> | null {
  const object = objectValue(value);
  return Object.keys(object).length ? object : null;
}

function jsonArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function stringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === "string" ? field : "";
}
