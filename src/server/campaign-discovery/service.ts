import { createHash } from "node:crypto";
import {
  candidateClassificationPromptVersion,
  classifyCandidatesWithAi,
  parseCandidateClassificationBatch,
  type CandidateClassification,
} from "@/lib/ai/candidate-classification";
import {
  evaluateLeadSourceWithAi,
  LEAD_EVALUATOR_PROMPT_VERSION,
  type LeadEvaluation,
  type LeadEvaluationInput,
} from "@/lib/ai/lead-evaluation";
import { getModelRoute } from "@/lib/ai/model-router";
import { createDiscoveryBounds } from "@/lib/campaign-agent/execution-policy";
import type { CampaignAgentPlan } from "@/lib/campaign-agent/loop";
import { extractDirectoryEntityCandidates } from "@/lib/discovery/directory-entity-extractor";
import { buildCampaignSearchQueries } from "@/lib/discovery/query-builder";
import {
  classifySearchResult,
  classifySearchResults,
} from "@/lib/discovery/result-classifier";
import {
  discoveryPlanPromptVersion,
  generateMarketAnalysisAndPlan,
  marketAnalysisPromptVersion,
} from "@/lib/campaign-workflow/market-planning";
import { extractWebPages, searchWeb, type SearchResult } from "@/lib/providers/tavily";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  loadProviderResult,
  storeProviderResult,
} from "@/server/execution/provider-result-cache";
import type { Campaign, CompanyProfile, Confidence } from "@/types/domain";

export type CampaignDiscoveryResult = {
  discoveredCount: number;
  decision: string;
  failedCount: number;
  inspectedCount: number;
  iterationNumber: number;
  qualifiedCount: number;
  rejectedCount: number;
  totalDiscoveredCount: number;
  totalQualifiedCount: number;
  queriesExecuted: string[];
};

export async function executeCampaignDiscovery(
  providerExecutionId: string,
  agentPlan?: CampaignAgentPlan,
): Promise<CampaignDiscoveryResult> {
  const supabase = createServiceRoleClient();
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,campaign_run_id,idempotency_key,metadata,status")
    .eq("id", providerExecutionId)
    .eq("operation", "campaign_discovery")
    .single();
  if (executionError)
    throw new Error(`Could not load discovery execution: ${executionError.message}`);
  if (!execution.campaign_run_id)
    throw new Error("Discovery execution is missing its Campaign Run.");
  const executionMetadata = asRecord(execution.metadata);
  const completedResult = asDiscoveryResult(executionMetadata.result);
  if (execution.status === "completed" && completedResult) return completedResult;
  const iterationNumber = positiveInteger(executionMetadata.agentIteration, 1);

  const context = await loadContext(execution.workspace_id, execution.campaign_run_id);
  const startedAt = new Date().toISOString();
  await updateExecution(providerExecutionId, {
    status: "running",
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });
  await updateRun(context.runId, {
    status: "discovering",
    current_phase: "discovering",
    progress_percentage: 10,
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });
  await appendEvent(
    context,
    "discovery_started",
    "discovering",
    "Company discovery started.",
  );

  try {
    const bounds = createDiscoveryBounds(context.desiredCompanyCount);
    let stagedPlan = await ensurePlanningArtifacts(
      context,
      execution.id,
      bounds.resultsPerQuery,
      iterationNumber,
    );
    if (agentPlan && iterationNumber > 1) {
      stagedPlan = await ensureRefinementPath(
        context,
        stagedPlan,
        agentPlan,
        iterationNumber,
      );
    }
    const queries = (
      agentPlan?.queries.length
        ? agentPlan.queries
        : stagedPlan?.queries.length
          ? stagedPlan.queries
          : buildCampaignSearchQueries(context.campaign)
    ).slice(0, bounds.queries);
    const resultsPerQuery = Math.min(
      agentPlan?.resultsPerQuery ?? bounds.resultsPerQuery,
      bounds.resultsPerQuery,
    );
    const searchInputHash = hash({
      iterationNumber,
      queries,
      resultsPerQuery,
      campaignRunId: context.runId,
    });
    let searchBatch = await loadProviderResult<{
      directoryEntities: Array<SearchResult & { query: string }>;
      rawResults: Array<SearchResult & { query: string }>;
    }>(providerExecutionId, searchInputHash, "search");
    if (!searchBatch) {
      const resultGroups = await Promise.all(
        queries.map(async (query) =>
          (await searchWeb(query, resultsPerQuery)).map((result) => ({
            ...result,
            query,
          })),
        ),
      );
      const rawResults = resultGroups.flat();
      searchBatch = {
        rawResults,
        directoryEntities: await expandDirectorySources(rawResults, bounds.companies),
      };
      await storeProviderResult(
        providerExecutionId,
        searchInputHash,
        searchBatch,
        "search",
      );
    }
    const { directoryEntities, rawResults } = searchBatch;
    const discoveryResults = [...rawResults, ...directoryEntities];
    const priorCandidateDomains = await loadCandidateDomains(context);
    const candidateBatch = await persistRawCandidatesAndClassifications(
      context,
      stagedPlan,
      discoveryResults,
      priorCandidateDomains,
      execution.id,
    );
    const classified = classifySearchResults(discoveryResults);
    const inspectable = classified.acceptedResults
      .filter(
        (result) =>
          !priorCandidateDomains.has(normalizedDomain(result.url)) &&
          candidateBatch.evaluatableCandidateKeys.has(candidateKey(result)),
      )
      .slice(0, bounds.companies);
    const inspectionInputHash = hash(
      inspectable.map((result) => ({
        content: result.content,
        query: result.query,
        url: normalizedUrl(result.url),
      })),
    );
    let accepted = await loadProviderResult<InspectedSearchResult[]>(
      providerExecutionId,
      inspectionInputHash,
      "first_party_inspection",
    );
    if (!accepted) {
      accepted = await inspectFirstPartyCandidates(inspectable);
      await storeProviderResult(
        providerExecutionId,
        inspectionInputHash,
        accepted,
        "first_party_inspection",
      );
    }
    const firstPartyInspectionCount = accepted.filter(
      (candidate) => candidate.firstPartyInspected,
    ).length;
    await updateRun(context.runId, {
      current_phase: "evaluating",
      progress_percentage: 40,
      companies_discovered: accepted.length,
      candidates_discovered: context.priorCandidatesDiscovered + discoveryResults.length,
      candidates_unique:
        context.priorCandidatesUnique +
        new Set(
          discoveryResults
            .map((result) => normalizedDomain(result.url))
            .filter((domain) => Boolean(domain) && !priorCandidateDomains.has(domain)),
        ).size,
      candidates_classified: context.priorCandidatesClassified + discoveryResults.length,
      metadata: {
        ...context.runMetadata,
        queryCount: queries.length,
        rawResultCount: classified.rawResults.length,
        directoryEntityCount: directoryEntities.length,
        rejectedResultCount: classified.rejectedResults.length,
        duplicateResultCount: classified.duplicateResults.length,
        firstPartyInspectionCount,
        firstPartyInspectionCoverage:
          accepted.length > 0 ? firstPartyInspectionCount / accepted.length : 0,
        executionLimits: bounds,
        agentPlan: agentPlan
          ? {
              rationale: agentPlan.rationale,
              resultsPerQuery,
            }
          : null,
      },
    });
    await appendEvent(
      context,
      "discovery_results_saved",
      "evaluating",
      `Discovered ${accepted.length} candidate compan${accepted.length === 1 ? "y" : "ies"}.`,
    );

    let iterationQualifiedCount = 0;
    let failedCount = 0;
    let evaluatedCount = 0;
    for (const [index, source] of accepted.entries()) {
      const association = await persistCandidate(context, source, index + 1);
      try {
        const qualificationStatus = await qualifyCandidate(
          context,
          execution.id,
          association.campaignCompanyId,
          association.companyId,
          association.sourceId,
          source,
        );
        if (qualificationStatus === "qualified") {
          iterationQualifiedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        await persistQualificationFailure(
          context,
          execution.id,
          association.campaignCompanyId,
          association.sourceId,
          source,
          error,
        );
      }
      evaluatedCount = index + 1;
      await updateRun(context.runId, {
        status: "qualifying",
        current_phase: "qualifying",
        progress_percentage:
          accepted.length === 0
            ? 90
            : 45 + Math.round(((index + 1) / accepted.length) * 45),
        companies_discovered: accepted.length,
        companies_qualified: iterationQualifiedCount,
        companies_evaluated: context.priorCompaniesEvaluated + evaluatedCount,
      });
      if (iterationQualifiedCount >= context.desiredCompanyCount) break;
    }

    const { count: totalDiscoveredCount, error: countError } = await supabase
      .from("campaign_companies")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", context.workspaceId)
      .eq("campaign_id", context.campaignId);
    if (countError)
      throw new Error(`Could not count discovered companies: ${countError.message}`);
    const cumulativeDiscovered = totalDiscoveredCount ?? accepted.length;
    const { count: totalQualifiedCount, error: qualifiedCountError } = await supabase
      .from("qualification_results")
      .select("id,campaign_company:campaign_companies!inner(campaign_id)", {
        count: "exact",
        head: true,
      })
      .eq("workspace_id", context.workspaceId)
      .eq("campaign_company.campaign_id", context.campaignId)
      .in("status", ["highly_relevant", "qualified"]);
    if (qualifiedCountError)
      throw new Error(
        `Could not count qualified companies: ${qualifiedCountError.message}`,
      );
    const cumulativeQualified = totalQualifiedCount ?? iterationQualifiedCount;
    const yieldRate =
      classified.rawResults.length > 0
        ? iterationQualifiedCount / classified.rawResults.length
        : 0;
    const iterationDecision =
      cumulativeQualified >= context.desiredCompanyCount
        ? "target_reached"
        : classified.rawResults.length === 0
          ? "market_exhausted"
          : yieldRate < 0.02
            ? "refine_queries"
            : iterationNumber >= 5
              ? "market_exhausted"
              : "continue";
    const { error: iterationError } = await supabase
      .from("discovery_iterations")
      .update({
        metrics: {
          queriesRun: queries.length,
          candidatesFound: classified.rawResults.length,
          uniqueCandidates: new Set(
            classified.rawResults
              .map((result) => normalizedDomain(result.url))
              .filter(Boolean),
          ).size,
          promisingCandidates: candidateBatch.classificationCounts.promising ?? 0,
          possibleCandidates: candidateBatch.classificationCounts.possible ?? 0,
          evaluatedCompanies: evaluatedCount,
          qualifiedCompanies: iterationQualifiedCount,
          cost: 0,
          yieldRate,
        },
        decision: iterationDecision,
        decision_reason:
          iterationDecision === "target_reached"
            ? "The requested qualified-company quantity was reached."
            : iterationDecision === "market_exhausted"
              ? "No raw candidates were returned."
              : iterationDecision === "refine_queries"
                ? "Marginal qualified yield fell below the configured threshold."
                : "The market still has useful discovery yield.",
        completed_at: new Date().toISOString(),
      })
      .eq("workspace_id", context.workspaceId)
      .eq("campaign_run_id", context.runId)
      .eq("iteration_number", iterationNumber);
    if (iterationError)
      throw new Error(
        `Could not finalize discovery iteration: ${iterationError.message}`,
      );
    const completedAt = new Date().toISOString();
    const shouldContinue =
      (iterationDecision === "continue" || iterationDecision === "refine_queries") &&
      iterationNumber < 5;
    const finalStatus = shouldContinue
      ? "planning"
      : failedCount > 0
        ? "partially_completed"
        : "completed";
    await updateRun(context.runId, {
      status: finalStatus,
      current_phase: shouldContinue ? "discovery_planning" : "ready_for_review",
      progress_percentage: shouldContinue ? Math.min(85, 15 + iterationNumber * 15) : 100,
      current_iteration: iterationNumber,
      companies_discovered: cumulativeDiscovered,
      companies_qualified: cumulativeQualified,
      companies_evaluated: context.priorCompaniesEvaluated + evaluatedCount,
      ...(shouldContinue ? {} : { completed_at: completedAt }),
      metadata: {
        ...context.runMetadata,
        queryCount: queries.length,
        qualificationFailureCount: failedCount,
        firstPartyInspectionCount,
        executionLimits: bounds,
      },
    });
    await appendEvent(
      context,
      "qualification_completed",
      shouldContinue ? "discovery_planning" : "ready_for_review",
      shouldContinue
        ? `Discovery iteration ${iterationNumber} completed. Refining the next search batch.`
        : `Qualification completed for ${accepted.length} candidate compan${accepted.length === 1 ? "y" : "ies"}.`,
      { failedCount, qualifiedCount: iterationQualifiedCount },
    );
    const result: CampaignDiscoveryResult = {
      discoveredCount: accepted.length,
      decision: iterationDecision,
      failedCount,
      inspectedCount: classified.rawResults.length,
      iterationNumber,
      qualifiedCount: iterationQualifiedCount,
      rejectedCount: classified.rejectedResults.length,
      totalDiscoveredCount: cumulativeDiscovered,
      totalQualifiedCount: cumulativeQualified,
      queriesExecuted: queries,
    };
    await updateExecution(providerExecutionId, {
      status: "completed",
      completed_at: completedAt,
      metadata: {
        ...asRecord(execution.metadata),
        discoveredCount: accepted.length,
        cumulativeDiscovered,
        failedCount,
        qualifiedCount: iterationQualifiedCount,
        cumulativeQualified,
        iterationDecision,
        iterationNumber,
        firstPartyInspectionCount,
        result,
      },
    });
    const { error: usageError } = await supabase.from("usage_ledger").upsert(
      {
        workspace_id: execution.workspace_id,
        campaign_run_id: context.runId,
        provider_execution_id: execution.id,
        operation: "campaign_discovery",
        entry_type: "settlement",
        idempotency_key: execution.idempotency_key,
        credits: accepted.length,
        metadata: {
          discoveredCount: accepted.length,
          cumulativeDiscovered,
          qualifiedCount: iterationQualifiedCount,
          queryCount: queries.length,
          firstPartyInspectionCount,
        },
      },
      { onConflict: "workspace_id,entry_type,idempotency_key" },
    );
    if (usageError)
      throw new Error(`Could not record discovery usage: ${usageError.message}`);
    return result;
  } catch (error) {
    throw error;
  }
}

async function loadContext(workspaceId: string, runId: string) {
  const supabase = createServiceRoleClient();
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select(
      "id,campaign_id,strategy_version_id,profile_snapshot_id,metadata,candidates_discovered,candidates_unique,candidates_classified,companies_evaluated,campaign:campaigns!inner(external_id,name,objective,preferred_outreach_language)",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", runId)
    .single();
  if (runError)
    throw new Error(`Could not load frozen Campaign Run: ${runError.message}`);
  const [
    { data: strategy, error: strategyError },
    { data: snapshot, error: snapshotError },
    { data: brief, error: briefError },
  ] = await Promise.all([
    supabase
      .from("campaign_strategy_versions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", run.strategy_version_id)
      .single(),
    supabase
      .from("campaign_profile_snapshots")
      .select("snapshot_data")
      .eq("workspace_id", workspaceId)
      .eq("id", run.profile_snapshot_id)
      .single(),
    supabase
      .from("campaign_briefs")
      .select("confirmed_brief")
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", run.campaign_id)
      .maybeSingle(),
  ]);
  if (strategyError)
    throw new Error(`Could not load frozen Strategy: ${strategyError.message}`);
  if (snapshotError)
    throw new Error(`Could not load frozen Company Profile: ${snapshotError.message}`);
  if (briefError) throw new Error(`Could not load Campaign Brief: ${briefError.message}`);

  const campaignRow = run.campaign as unknown as {
    external_id: string;
    name: string;
    objective: string;
    preferred_outreach_language: string;
  };
  const sellerProfile = mapSellerProfile(snapshot.snapshot_data);
  const strategyDocument = asRecord(strategy.strategy);
  const desiredCompanyCount = positiveInteger(
    asRecord(run.metadata).desiredCompanyCount,
    strategyDocument.targetCompanyCount,
  );
  const campaign: Campaign & { sellerProfile: typeof sellerProfile } = {
    id: campaignRow.external_id,
    name: campaignRow.name,
    objective: campaignRow.objective,
    geography: stringValue(strategyDocument.targetGeography),
    industryTerms: stringArray(strategyDocument.industries),
    targetSegments: stringArray(strategyDocument.companyTypes),
    progress: 0,
    leadCount: 0,
    desiredLeadCount: desiredCompanyCount,
    awaitingReview: 0,
    status: "running",
    lastActivity: "",
    preferredOutreachLanguage: campaignRow.preferred_outreach_language ?? "English",
    discoveryLanguages: stringArray(strategyDocument.searchLanguages),
    warnings: [],
    latestDiscoveryReport: null,
    strategy: {
      terms: stringArray(strategyDocument.searchTerms),
      localizedTerms: stringArray(strategyDocument.localizedTerms),
      sources: stringArray(strategyDocument.sourceCategories),
      criteria: stringArray(strategyDocument.qualificationCriteria),
      exclusions: stringArray(strategyDocument.exclusions),
      limitations: stringArray(strategyDocument.limitations),
    },
    sellerProfile,
  };
  return {
    workspaceId,
    runId,
    campaignId: run.campaign_id,
    runMetadata: asRecord(run.metadata),
    priorCandidatesDiscovered: Number(run.candidates_discovered) || 0,
    priorCandidatesUnique: Number(run.candidates_unique) || 0,
    priorCandidatesClassified: Number(run.candidates_classified) || 0,
    priorCompaniesEvaluated: Number(run.companies_evaluated) || 0,
    desiredCompanyCount,
    campaign,
    sellerProfile,
    profileSnapshot: asRecord(snapshot.snapshot_data),
    confirmedBrief: asRecord(brief?.confirmed_brief),
  };
}

async function ensurePlanningArtifacts(
  context: Awaited<ReturnType<typeof loadContext>>,
  providerExecutionId: string,
  defaultResultsPerQuery: number,
  iterationNumber: number,
) {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("discovery_plans")
    .select("id,discovery_paths(id,external_id,queries,max_results)")
    .eq("workspace_id", context.workspaceId)
    .eq("campaign_run_id", context.runId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const paths = (existing.discovery_paths ?? []) as Array<{
      id: string;
      external_id: string;
      queries: string[];
      max_results: number;
    }>;
    return {
      planId: existing.id,
      queries: paths.flatMap((path) => path.queries),
      paths,
      iterationId: await ensureIteration(
        context,
        existing.id,
        "Continue the persisted discovery plan.",
        iterationNumber,
      ),
    };
  }

  await updateRun(context.runId, {
    status: "planning",
    current_phase: "market_analysis",
    progress_percentage: 5,
  });
  await appendEvent(
    context,
    "market_analysis_started",
    "market_analysis",
    "Analyzing the selected market.",
  );
  const generated = await generateMarketAnalysisAndPlan({
    campaign: context.campaign,
    confirmedBrief: context.confirmedBrief,
    profileSnapshot: context.profileSnapshot,
    targetQualifiedCompanies: context.desiredCompanyCount,
  });
  const modelConfigId = await resolveModelConfigId(
    context.workspaceId,
    "campaign_planning",
  );
  const requestedModel = generated.modelCall.requestedModel;
  const actualModel = generated.modelCall.actualModel ?? requestedModel;
  const { data: analysis, error: analysisError } = await supabase
    .from("market_analyses")
    .insert({
      workspace_id: context.workspaceId,
      campaign_id: context.campaignId,
      campaign_run_id: context.runId,
      version: 1,
      analysis: generated.marketAnalysis,
      prompt_version: marketAnalysisPromptVersion,
      requested_model: requestedModel,
      actual_model: actualModel,
      fallback_used: generated.modelCall.fallbackUsed,
      confidence: generated.marketAnalysis.confidence,
    })
    .select("id")
    .single();
  if (analysisError)
    throw new Error(`Could not save market analysis: ${analysisError.message}`);
  const { data: plan, error: planError } = await supabase
    .from("discovery_plans")
    .insert({
      workspace_id: context.workspaceId,
      campaign_id: context.campaignId,
      campaign_run_id: context.runId,
      market_analysis_id: analysis.id,
      version: 1,
      strategy_summary: generated.discoveryPlan.strategySummary,
      stop_conditions: generated.discoveryPlan.stopConditions,
      prompt_version: discoveryPlanPromptVersion,
      requested_model: requestedModel,
      actual_model: actualModel,
      fallback_used: generated.modelCall.fallbackUsed,
    })
    .select("id")
    .single();
  if (planError) throw new Error(`Could not save discovery plan: ${planError.message}`);
  const pathRows = generated.discoveryPlan.paths.map((path) => ({
    workspace_id: context.workspaceId,
    discovery_plan_id: plan.id,
    external_id: path.id,
    path_type: path.type,
    rationale: path.rationale,
    expected_company_category: path.expectedCompanyCategory,
    priority: path.priority,
    queries: path.queries,
    source_hints: path.sourceHints ?? [],
    expected_yield: path.expectedYield ?? null,
    max_results: Math.min(path.maxResults, defaultResultsPerQuery),
  }));
  const { data: paths, error: pathsError } = await supabase
    .from("discovery_paths")
    .insert(pathRows)
    .select("id,external_id,queries,max_results");
  if (pathsError)
    throw new Error(`Could not save discovery paths: ${pathsError.message}`);
  const requestHash = hash({
    campaign: context.campaign,
    confirmedBrief: context.confirmedBrief,
    profileSnapshotId: context.profileSnapshot,
  });
  const completedAt = new Date().toISOString();
  const { error: aiError } = await supabase.from("ai_requests").insert({
    workspace_id: context.workspaceId,
    campaign_run_id: context.runId,
    provider_execution_id: providerExecutionId,
    model_config_id: modelConfigId,
    role: "campaign_planning",
    provider: "openrouter",
    selected_model: actualModel,
    fallback_model: generated.modelCall.fallbackUsed ? actualModel : null,
    fallback_used: generated.modelCall.fallbackUsed,
    prompt_version: marketAnalysisPromptVersion,
    schema_version: "market-analysis-discovery-plan-v1",
    request_hash: requestHash,
    status: "completed",
    input_units: generated.modelCall.inputTokens,
    output_units: generated.modelCall.outputTokens,
    actual_cost: generated.modelCall.providerReportedCost ?? 0,
    currency: generated.modelCall.providerCurrency ?? "USD",
    metadata: { marketAnalysisId: analysis.id, discoveryPlanId: plan.id },
    started_at: completedAt,
    completed_at: completedAt,
  });
  if (aiError) throw new Error(`Could not log market planning: ${aiError.message}`);
  await appendEvent(
    context,
    "market_analysis_completed",
    "discovery_planning",
    "Market analysis complete. Discovery is starting.",
    { marketAnalysisId: analysis.id, discoveryPlanId: plan.id },
  );
  return {
    planId: plan.id,
    queries: generated.discoveryPlan.paths.flatMap((path) => path.queries),
    paths: paths ?? [],
    iterationId: await ensureIteration(
      context,
      plan.id,
      generated.discoveryPlan.strategySummary,
      iterationNumber,
    ),
  };
}

async function ensureIteration(
  context: Awaited<ReturnType<typeof loadContext>>,
  discoveryPlanId: string,
  objective: string,
  iterationNumber: number,
) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_iterations")
    .upsert(
      {
        workspace_id: context.workspaceId,
        campaign_id: context.campaignId,
        campaign_run_id: context.runId,
        discovery_plan_id: discoveryPlanId,
        iteration_number: iterationNumber,
        objective,
      },
      { onConflict: "campaign_run_id,iteration_number" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Could not prepare discovery iteration: ${error.message}`);
  return data.id;
}

async function ensureRefinementPath(
  context: Awaited<ReturnType<typeof loadContext>>,
  stagedPlan: Awaited<ReturnType<typeof ensurePlanningArtifacts>>,
  plan: CampaignAgentPlan,
  iterationNumber: number,
) {
  const supabase = createServiceRoleClient();
  const externalId = `refinement-${iterationNumber}`;
  const { data, error } = await supabase
    .from("discovery_paths")
    .upsert(
      {
        workspace_id: context.workspaceId,
        discovery_plan_id: stagedPlan.planId,
        external_id: externalId,
        path_type: "industry_terminology",
        rationale: plan.rationale,
        expected_company_category: context.campaign.targetSegments[0] ?? "Target company",
        priority: iterationNumber + 10,
        queries: plan.queries,
        source_hints: ["deterministic_refinement"],
        expected_yield: "medium",
        max_results: Math.min(plan.resultsPerQuery, 50),
      },
      { onConflict: "discovery_plan_id,external_id" },
    )
    .select("id,external_id,queries,max_results")
    .single();
  if (error) throw new Error(`Could not save refinement path: ${error.message}`);
  return {
    ...stagedPlan,
    queries: plan.queries,
    paths: [...stagedPlan.paths.filter((path) => path.external_id !== externalId), data],
  };
}

async function persistRawCandidatesAndClassifications(
  context: Awaited<ReturnType<typeof loadContext>>,
  stagedPlan: Awaited<ReturnType<typeof ensurePlanningArtifacts>>,
  results: Array<SearchResult & { query: string }>,
  priorDomains: ReadonlySet<string>,
  providerExecutionId: string,
) {
  const evaluatableCandidateKeys = new Set<string>();
  const classificationCounts: Record<string, number> = {};
  if (!stagedPlan) return { classificationCounts, evaluatableCandidateKeys };
  const supabase = createServiceRoleClient();
  const paths = stagedPlan.paths as Array<{
    id: string;
    external_id: string;
    queries: string[];
    max_results: number;
  }>;
  const queryRows = results.length
    ? Array.from(new Set(results.map((result) => result.query))).map((query) => {
        const path =
          paths.find((candidate) => candidate.queries.includes(query)) ?? paths[0];
        if (!path) throw new Error("The discovery plan has no persisted paths.");
        return {
          workspace_id: context.workspaceId,
          discovery_iteration_id: stagedPlan.iterationId,
          discovery_path_id: path.id,
          query,
          source_type: path.external_id,
          result_limit: Math.min(path.max_results, 50),
          provider: "tavily",
          retrieved_at: new Date().toISOString(),
        };
      })
    : [];
  if (!queryRows.length) return { classificationCounts, evaluatableCandidateKeys };
  const { data: queries, error: queryError } = await supabase
    .from("discovery_queries")
    .upsert(queryRows, {
      onConflict: "discovery_iteration_id,discovery_path_id,query",
    })
    .select("id,query,discovery_path_id");
  if (queryError)
    throw new Error(`Could not save discovery queries: ${queryError.message}`);
  const queryByText = new Map((queries ?? []).map((query) => [query.query, query]));
  const seenDomains = new Set(priorDomains);
  const prepared = new Map<
    string,
    {
      duplicate: boolean;
      sourceClassification: ReturnType<typeof classifySearchResult>;
    }
  >();
  const ambiguous: Array<{
    candidateKey: string;
    title: string;
    url: string;
    snippet: string;
    deterministicSourceType: string;
  }> = [];
  for (const result of results) {
    const key = candidateKey(result);
    const domain = normalizedDomain(result.url);
    const sourceClassification = classifySearchResult(result);
    const duplicate = Boolean(domain && seenDomains.has(domain));
    if (domain) seenDomains.add(domain);
    if (!prepared.has(key)) prepared.set(key, { duplicate, sourceClassification });
    if (
      !duplicate &&
      (sourceClassification.sourceType === "company_website" ||
        sourceClassification.sourceType === "company_contact_page") &&
      !ambiguous.some((candidate) => candidate.candidateKey === key)
    ) {
      ambiguous.push({
        candidateKey: key,
        title: result.title,
        url: result.url,
        snippet: result.content.slice(0, 4_000),
        deterministicSourceType: sourceClassification.sourceType,
      });
    }
  }
  const aiBatch = ambiguous.length
    ? await loadOrClassifyCandidateBatch({
        ambiguous,
        context,
        providerExecutionId,
      })
    : null;
  const aiByKey = new Map(
    (aiBatch?.classifications ?? []).map((classification) => [
      classification.candidateKey,
      classification,
    ]),
  );
  const now = new Date().toISOString();
  for (const result of results) {
    const query = queryByText.get(result.query);
    if (!query) continue;
    const domain = normalizedDomain(result.url);
    const key = candidateKey(result);
    const deterministic = prepared.get(key);
    if (!deterministic) continue;
    const { duplicate, sourceClassification } = deterministic;
    const aiClassification = aiByKey.get(key);
    const deterministicStatus = duplicate
      ? "duplicate"
      : sourceClassification.sourceType === "unknown"
        ? "insufficient_data"
        : "excluded";
    const status = aiClassification?.status ?? deterministicStatus;
    classificationCounts[status] = (classificationCounts[status] ?? 0) + 1;
    const shouldEvaluate = aiClassification?.shouldEvaluate ?? false;
    if (shouldEvaluate) evaluatableCandidateKeys.add(key);
    const path = paths.find((candidate) => candidate.id === query.discovery_path_id);
    const { data: candidate, error: candidateError } = await supabase
      .from("discovery_candidates")
      .upsert(
        {
          workspace_id: context.workspaceId,
          campaign_id: context.campaignId,
          campaign_run_id: context.runId,
          discovery_iteration_id: stagedPlan.iterationId,
          discovery_query_id: query.id,
          candidate_key: candidateIdentityKey(result, context.campaign.geography),
          company_name: normalizeName(result.title),
          normalized_domain: domain || null,
          source_url: result.url,
          source_type: sourceClassification.sourceType,
          source_query: result.query,
          source_path: path?.external_id ?? "unknown",
          snippet: result.content,
          country_region: context.campaign.geography,
          probable_category: sourceClassification.sourceType,
          discovery_confidence:
            sourceClassification.confidence === "high"
              ? 0.95
              : sourceClassification.confidence === "medium"
                ? 0.7
                : 0.4,
          retrieved_at: now,
        },
        {
          onConflict: "campaign_run_id,discovery_iteration_id,candidate_key",
        },
      )
      .select("id")
      .single();
    if (candidateError)
      throw new Error(`Could not save discovery candidate: ${candidateError.message}`);
    const reasons =
      aiClassification?.reasons ??
      (duplicate
        ? ["Duplicate normalized company domain."]
        : [...sourceClassification.reasons, ...sourceClassification.riskFlags]);
    const { error: evidenceError } = await supabase
      .from("discovery_candidate_evidence")
      .upsert(
        {
          workspace_id: context.workspaceId,
          campaign_run_id: context.runId,
          candidate_id: candidate.id,
          discovery_query_id: query.id,
          source_url: result.url,
          source_query: result.query,
          source_path: path?.external_id ?? "unknown",
          snippet: result.content,
          retrieved_at: now,
        },
        {
          ignoreDuplicates: true,
          onConflict: "candidate_id,discovery_query_id,source_url",
        },
      );
    if (evidenceError)
      throw new Error(
        `Could not merge discovery candidate evidence: ${evidenceError.message}`,
      );
    const classificationInputHash = hash({
      result,
      sourceClassification,
      duplicate,
    });
    const { error: classificationError } = await supabase
      .from("candidate_classifications")
      .upsert(
        {
          workspace_id: context.workspaceId,
          campaign_run_id: context.runId,
          candidate_id: candidate.id,
          status,
          confidence: aiClassification?.confidence ?? (duplicate ? 0.95 : 0.8),
          probable_category:
            aiClassification?.probableCategory ?? sourceClassification.sourceType,
          geography_match: aiClassification?.geographyMatch ?? null,
          exclusion_reason:
            aiClassification?.exclusionReason ??
            (shouldEvaluate ? null : reasons.join("; ")),
          reasons,
          should_evaluate: shouldEvaluate,
          model_role: aiClassification ? "search_result_classification" : null,
          prompt_version: aiClassification
            ? candidateClassificationPromptVersion
            : "deterministic-search-result-classification-v1",
          requested_model: aiClassification ? aiBatch?.requestedModel : null,
          actual_model: aiClassification ? aiBatch?.actualModel : null,
          input_hash: classificationInputHash,
        },
        {
          ignoreDuplicates: true,
          onConflict: "candidate_id,input_hash",
        },
      );
    if (classificationError)
      throw new Error(
        `Could not save candidate classification: ${classificationError.message}`,
      );
  }
  return { classificationCounts, evaluatableCandidateKeys };
}

async function loadOrClassifyCandidateBatch(input: {
  ambiguous: Array<{
    candidateKey: string;
    title: string;
    url: string;
    snippet: string;
    deterministicSourceType: string;
  }>;
  context: Awaited<ReturnType<typeof loadContext>>;
  providerExecutionId: string;
}): Promise<{
  classifications: CandidateClassification[];
  requestedModel: string;
  actualModel: string;
}> {
  const supabase = createServiceRoleClient();
  const campaign = {
    geography: input.context.campaign.geography,
    companyTypes: input.context.campaign.targetSegments,
    industries: input.context.campaign.industryTerms,
    characteristics: input.context.campaign.strategy.criteria,
    exclusions: input.context.campaign.strategy.exclusions,
  };
  const requestHash = hash({
    campaign,
    candidates: input.ambiguous,
    promptVersion: candidateClassificationPromptVersion,
  });
  const expectedKeys = new Set(
    input.ambiguous.map((candidate) => candidate.candidateKey),
  );
  const { data: existing, error: existingError } = await supabase
    .from("ai_requests")
    .select("selected_model,metadata")
    .eq("workspace_id", input.context.workspaceId)
    .eq("provider_execution_id", input.providerExecutionId)
    .eq("role", "search_result_classification")
    .eq("request_hash", requestHash)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  if (existingError)
    throw new Error(
      `Could not load prior candidate classification: ${existingError.message}`,
    );
  const existingMetadata = asRecord(existing?.metadata);
  if (existing && existingMetadata.classifications) {
    return {
      classifications: parseCandidateClassificationBatch(
        { classifications: existingMetadata.classifications },
        expectedKeys,
      ),
      requestedModel:
        stringValue(existingMetadata.requestedModel) || existing.selected_model,
      actualModel: existing.selected_model,
    };
  }

  const generated = await classifyCandidatesWithAi({
    campaign,
    candidates: input.ambiguous,
  });
  const modelConfigId = await resolveModelConfigId(
    input.context.workspaceId,
    "search_result_classification",
  );
  const actualModel =
    generated.modelCall.actualModel ?? generated.modelCall.requestedModel;
  const completedAt = new Date().toISOString();
  const { error: aiError } = await supabase.from("ai_requests").insert({
    workspace_id: input.context.workspaceId,
    campaign_run_id: input.context.runId,
    provider_execution_id: input.providerExecutionId,
    model_config_id: modelConfigId,
    role: "search_result_classification",
    provider: "openrouter",
    selected_model: actualModel,
    fallback_model: generated.modelCall.fallbackUsed ? actualModel : null,
    fallback_used: generated.modelCall.fallbackUsed,
    prompt_version: candidateClassificationPromptVersion,
    schema_version: "candidate-classification-v1",
    request_hash: requestHash,
    status: "completed",
    input_units: generated.modelCall.inputTokens,
    output_units: generated.modelCall.outputTokens,
    actual_cost: generated.modelCall.providerReportedCost ?? 0,
    currency: generated.modelCall.providerCurrency ?? "USD",
    metadata: {
      requestedModel: generated.modelCall.requestedModel,
      classifications: generated.classifications,
      candidateCount: input.ambiguous.length,
    },
    started_at: completedAt,
    completed_at: completedAt,
  });
  if (aiError)
    throw new Error(`Could not log candidate classification: ${aiError.message}`);
  return {
    classifications: generated.classifications,
    requestedModel: generated.modelCall.requestedModel,
    actualModel,
  };
}

async function loadCandidateDomains(
  context: Awaited<ReturnType<typeof loadContext>>,
): Promise<Set<string>> {
  const supabase = createServiceRoleClient();
  const domains = new Set<string>();
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("discovery_candidates")
      .select("normalized_domain")
      .eq("workspace_id", context.workspaceId)
      .eq("campaign_run_id", context.runId)
      .not("normalized_domain", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not load candidate domains: ${error.message}`);
    for (const row of data ?? []) {
      if (row.normalized_domain) domains.add(row.normalized_domain);
    }
    if (!data || data.length < pageSize) break;
  }
  return domains;
}

async function persistCandidate(
  context: Awaited<ReturnType<typeof loadContext>>,
  source: InspectedSearchResult,
  rank: number,
) {
  const supabase = createServiceRoleClient();
  const website = origin(source.url);
  const domain = normalizedDomain(website);
  const name = normalizeName(source.title);
  const { data: companyId, error: companyError } = await supabase.rpc(
    "resolve_discovered_company",
    {
      target_workspace_id: context.workspaceId,
      company_name_value: name,
      normalized_name_value: normalizeNameKey(name),
      website_url_value: website,
      country_value: context.campaign.geography,
      description_value: source.content || source.title,
      metadata_value: {
        discoveredBy: "tavily",
        firstPartyInspected: source.firstPartyInspected,
      },
      normalized_domain_value: domain,
    },
  );
  if (companyError || !companyId)
    throw new Error(
      `Could not resolve discovered company: ${companyError?.message ?? "no company returned"}`,
    );

  const { data: companySource, error: sourceError } = await supabase
    .from("company_sources")
    .upsert(
      {
        workspace_id: context.workspaceId,
        company_id: companyId,
        campaign_run_id: context.runId,
        provider: "tavily",
        source_type: "search_result",
        query: source.query,
        title: source.title,
        source_url: source.url,
        original_url: source.originalUrl,
        excerpt: source.content || source.title,
        raw_content: source.content || null,
        metadata: {
          classification: source.classification,
          score: source.score,
          firstPartyInspected: source.firstPartyInspected,
          originalResultUrl: source.originalUrl,
        },
      },
      { onConflict: "workspace_id,provider,source_url" },
    )
    .select("id")
    .single();
  if (sourceError)
    throw new Error(`Could not save company source: ${sourceError.message}`);

  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .upsert(
      {
        workspace_id: context.workspaceId,
        campaign_id: context.campaignId,
        campaign_run_id: context.runId,
        company_id: companyId,
        status: "researching",
        discovery_rank: rank,
        source_summary: source.content || source.title,
        metadata: {
          sourceScore: source.score,
          firstPartyInspected: source.firstPartyInspected,
        },
      },
      { onConflict: "campaign_id,company_id" },
    )
    .select("id")
    .single();
  if (associationError)
    throw new Error(
      `Could not associate discovered company: ${associationError.message}`,
    );
  return {
    campaignCompanyId: association.id,
    companyId,
    sourceId: companySource.id,
  };
}

async function qualifyCandidate(
  context: Awaited<ReturnType<typeof loadContext>>,
  providerExecutionId: string,
  campaignCompanyId: string,
  companyId: string,
  sourceId: string,
  source: InspectedSearchResult,
) {
  const supabase = createServiceRoleClient();
  const classification = asRecord(source.classification);
  const input: LeadEvaluationInput = {
    campaign: {
      geography: context.campaign.geography,
      industryTerms: context.campaign.industryTerms,
      discoveryLanguages: context.campaign.discoveryLanguages,
      objective: context.campaign.objective,
      targetSegments: context.campaign.targetSegments,
      strategy: {
        criteria: context.campaign.strategy.criteria,
        exclusions: context.campaign.strategy.exclusions,
        terms: context.campaign.strategy.terms,
      },
    },
    sellerProfile: context.sellerProfile,
    source: {
      classification: stringValue(classification.sourceType) || "unknown",
      content: source.content,
      query: source.query,
      rejectionReason: null,
      title: source.title,
      url: source.url,
    },
  };
  const generated = await evaluateLeadSourceWithAi(input);
  const evaluation = generated.evaluation;
  const inputHash = hash(generated.promptInput);
  const modelConfigId = await resolveModelConfigId(
    context.workspaceId,
    "company_qualification",
  );
  const { error: companyError } = await supabase
    .from("companies")
    .update({
      name: evaluation.companyName ?? source.title,
      normalized_name: normalizeNameKey(evaluation.companyName ?? source.title),
      website_url: evaluation.website ?? origin(source.url),
      country: evaluation.country,
      city: evaluation.city,
      industry: evaluation.industry,
      company_type: evaluation.companyType,
      description: evaluation.summary,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", companyId);
  if (companyError)
    throw new Error(`Could not update qualified company: ${companyError.message}`);

  const resultId = await persistQualification({
    context,
    campaignCompanyId,
    sourceId,
    sourceUrl: source.url,
    evaluation,
    inputHash,
    modelConfigId,
  });
  const completedAt = new Date().toISOString();
  const { error: aiError } = await supabase.from("ai_requests").insert({
    workspace_id: context.workspaceId,
    campaign_run_id: context.runId,
    provider_execution_id: providerExecutionId,
    model_config_id: modelConfigId,
    role: "company_qualification",
    provider: "openrouter",
    selected_model: generated.modelCall.actualModel ?? generated.modelCall.requestedModel,
    fallback_model: generated.modelCall.fallbackUsed
      ? generated.modelCall.actualModel
      : null,
    fallback_used: generated.modelCall.fallbackUsed,
    prompt_version: LEAD_EVALUATOR_PROMPT_VERSION,
    schema_version: "company-qualification-v1",
    request_hash: inputHash,
    status: "completed",
    input_units: generated.modelCall.inputTokens,
    output_units: generated.modelCall.outputTokens,
    actual_cost: generated.modelCall.providerReportedCost ?? 0,
    currency: generated.modelCall.providerCurrency ?? "USD",
    metadata: { campaignCompanyId, qualificationResultId: resultId },
    started_at: completedAt,
    completed_at: completedAt,
  });
  if (aiError) throw new Error(`Could not log company qualification: ${aiError.message}`);
  return evaluation.qualificationStatus;
}

type InspectedSearchResult = SearchResult & {
  classification: unknown;
  firstPartyInspected: boolean;
  originalUrl: string;
  query: string;
};

async function expandDirectorySources(
  results: Array<SearchResult & { query: string }>,
  companyLimit: number,
) {
  const directorySources = results
    .filter((result) => classifySearchResult(result).sourceType === "directory")
    .slice(0, 10);
  if (!directorySources.length) return [];

  const extractedByUrl = new Map<string, SearchResult>();
  try {
    const extracted = await extractWebPages(directorySources.map((source) => source.url));
    for (const page of extracted) {
      extractedByUrl.set(normalizedUrl(page.url), page);
    }
  } catch {
    // Directory extraction is opportunistic; direct company results still proceed.
  }

  const candidates = directorySources.flatMap((source) => {
    const page = extractedByUrl.get(normalizedUrl(source.url));
    return page ? extractDirectoryEntityCandidates(source, page.content, 5) : [];
  });
  const seenDomains = new Set<string>();
  return candidates
    .filter((candidate) => {
      const domain = normalizedDomain(candidate.url);
      if (!domain || seenDomains.has(domain)) return false;
      seenDomains.add(domain);
      return true;
    })
    .slice(0, Math.min(companyLimit, 25));
}

async function inspectFirstPartyCandidates(
  candidates: Array<SearchResult & { classification: unknown; query: string }>,
): Promise<InspectedSearchResult[]> {
  const homepages = [
    ...new Set(candidates.map((candidate) => origin(candidate.url)).filter(Boolean)),
  ];
  const extracted = new Map<string, SearchResult>();
  for (let offset = 0; offset < homepages.length; offset += 20) {
    try {
      const results = await extractWebPages(homepages.slice(offset, offset + 20));
      for (const result of results) extracted.set(normalizedUrl(result.url), result);
    } catch {
      // Search-result evidence remains available when optional first-party inspection fails.
    }
  }
  return candidates.map((candidate) => {
    const homepage = origin(candidate.url);
    const inspection = extracted.get(normalizedUrl(homepage));
    const inspectedContent = inspection?.content.trim() ?? "";
    return {
      ...candidate,
      content:
        inspectedContent.length >= 100
          ? `${inspectedContent}\n\nDiscovery context: ${candidate.content}`.slice(
              0,
              30_000,
            )
          : candidate.content,
      firstPartyInspected: inspectedContent.length >= 100,
      originalUrl: candidate.url,
      url: inspectedContent.length >= 100 ? homepage : candidate.url,
    };
  });
}

async function persistQualification(input: {
  context: Awaited<ReturnType<typeof loadContext>>;
  campaignCompanyId: string;
  sourceId: string;
  sourceUrl: string;
  evaluation: LeadEvaluation;
  inputHash: string;
  modelConfigId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("qualification_results")
    .select("id")
    .eq("workspace_id", input.context.workspaceId)
    .eq("campaign_company_id", input.campaignCompanyId)
    .eq("input_hash", input.inputHash)
    .maybeSingle();
  if (existing) return existing.id;
  const status =
    input.evaluation.qualificationStatus === "disqualified"
      ? "not_relevant"
      : input.evaluation.relevanceScore >= 80
        ? "highly_relevant"
        : input.evaluation.qualificationStatus === "qualified"
          ? "qualified"
          : "possible";
  const { data: result, error } = await supabase
    .from("qualification_results")
    .insert({
      workspace_id: input.context.workspaceId,
      campaign_company_id: input.campaignCompanyId,
      campaign_run_id: input.context.runId,
      status,
      score: input.evaluation.relevanceScore,
      confidence: input.evaluation.confidence,
      summary: input.evaluation.summary,
      relationship_hypothesis: input.evaluation.suggestedNextAction,
      recommended_roles: [],
      positive_signals: input.evaluation.fitReasons,
      negative_signals: input.evaluation.disqualifyingSignals,
      missing_evidence: input.evaluation.missingInfo,
      schema_version: "company-qualification-v1",
      prompt_version: LEAD_EVALUATOR_PROMPT_VERSION,
      model_config_id: input.modelConfigId,
      input_hash: input.inputHash,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save qualification: ${error.message}`);
  const dimensions = qualificationDimensions(input.evaluation);
  const { error: dimensionsError } = await supabase
    .from("qualification_dimensions")
    .insert(
      dimensions.map((dimension) => ({
        workspace_id: input.context.workspaceId,
        qualification_result_id: result.id,
        criterion: dimension.criterion,
        score: dimension.score,
        confidence: dimension.confidence,
        explanation: dimension.explanation,
      })),
    );
  if (dimensionsError)
    throw new Error(
      `Could not save qualification dimensions: ${dimensionsError.message}`,
    );
  const statements = [
    ...input.evaluation.fitReasons.map((statement) => ({
      kind: "inference" as const,
      statement,
    })),
    ...input.evaluation.disqualifyingSignals.map((statement) => ({
      kind: "inference" as const,
      statement,
    })),
  ];
  if (statements.length) {
    const { error: evidenceError } = await supabase.from("qualification_evidence").insert(
      statements.map((item) => ({
        workspace_id: input.context.workspaceId,
        qualification_result_id: result.id,
        criterion: "Campaign fit",
        evidence_kind: item.kind,
        statement: item.statement,
        source_url: input.sourceUrl,
        source_id: input.sourceId,
        confidence: input.evaluation.confidence,
        metadata: { source_type: "AI lead qualification" },
      })),
    );
    if (evidenceError)
      throw new Error(`Could not save qualification evidence: ${evidenceError.message}`);
  }
  await updateCampaignCompanyState(
    input.context.workspaceId,
    input.campaignCompanyId,
    status === "not_relevant" ? "rejected" : "needs_review",
    null,
  );
  return result.id;
}

async function persistQualificationFailure(
  context: Awaited<ReturnType<typeof loadContext>>,
  providerExecutionId: string,
  campaignCompanyId: string,
  sourceId: string,
  source: SearchResult,
  error: unknown,
) {
  const message =
    error instanceof Error ? error.message.slice(0, 1000) : "Qualification failed";
  const inputHash = hash({ sourceUrl: source.url, error: message });
  const supabase = createServiceRoleClient();
  const route = getModelRoute("company_qualification");
  const { data: existing } = await supabase
    .from("qualification_results")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("campaign_company_id", campaignCompanyId)
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (!existing) {
    const { data: result, error: resultError } = await supabase
      .from("qualification_results")
      .insert({
        workspace_id: context.workspaceId,
        campaign_company_id: campaignCompanyId,
        campaign_run_id: context.runId,
        status: "insufficient_evidence",
        score: 40,
        confidence: "low",
        summary: "Qualification requires manual review.",
        relationship_hypothesis: "",
        positive_signals: [],
        negative_signals: [],
        missing_evidence: [message],
        schema_version: "company-qualification-v1",
        prompt_version: LEAD_EVALUATOR_PROMPT_VERSION,
        input_hash: inputHash,
      })
      .select("id")
      .single();
    if (resultError)
      throw new Error(`Could not preserve failed qualification: ${resultError.message}`);
    await supabase.from("qualification_evidence").insert({
      workspace_id: context.workspaceId,
      qualification_result_id: result.id,
      criterion: "Evidence quality",
      evidence_kind: "unknown",
      statement: `AI qualification failed: ${message}`,
      source_url: source.url,
      source_id: sourceId,
      confidence: "low",
      metadata: { source_type: "ai_qualification_failure" },
    });
  }
  await updateCampaignCompanyState(
    context.workspaceId,
    campaignCompanyId,
    "needs_review",
    message,
  );
  const completedAt = new Date().toISOString();
  const { error: requestError } = await supabase.from("ai_requests").insert({
    workspace_id: context.workspaceId,
    campaign_run_id: context.runId,
    provider_execution_id: providerExecutionId,
    role: "company_qualification",
    provider: "openrouter",
    selected_model: route.primaryModel,
    prompt_version: LEAD_EVALUATOR_PROMPT_VERSION,
    schema_version: "company-qualification-v1",
    request_hash: inputHash,
    status: "failed",
    error_message: message,
    metadata: { campaignCompanyId },
    started_at: completedAt,
    completed_at: completedAt,
  });
  if (requestError)
    throw new Error(
      `Could not log failed company qualification: ${requestError.message}`,
    );
}

async function updateCampaignCompanyState(
  workspaceId: string,
  id: string,
  status: "needs_review" | "rejected",
  qualificationError: string | null,
) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("campaign_companies")
    .select("metadata")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("campaign_companies")
    .update({
      status,
      last_evaluated_at: new Date().toISOString(),
      metadata: {
        ...asRecord(data?.metadata),
        qualification_error: qualificationError,
      },
    })
    .eq("workspace_id", workspaceId)
    .eq("id", id);
  if (error) throw new Error(`Could not update qualification state: ${error.message}`);
}

function qualificationDimensions(evaluation: LeadEvaluation) {
  return [
    {
      criterion: "Campaign fit",
      score: evaluation.relevanceScore,
      confidence: evaluation.confidence,
      explanation: evaluation.fitReasons.join("; ") || "AI evaluated Campaign fit.",
    },
    {
      criterion: "Evidence quality",
      score: evaluation.missingInfo.length ? 45 : 65,
      confidence: (evaluation.missingInfo.length ? "low" : "medium") as Confidence,
      explanation:
        evaluation.missingInfo.join("; ") || "Source evidence supports manual review.",
    },
    {
      criterion: "Contactability",
      score:
        evaluation.contactability === "high"
          ? 75
          : evaluation.contactability === "medium"
            ? 55
            : 30,
      confidence: evaluation.contactability,
      explanation: evaluation.suggestedNextAction,
    },
  ];
}

async function resolveModelConfigId(
  workspaceId: string,
  role: "campaign_planning" | "company_qualification" | "search_result_classification",
) {
  const { data, error } = await createServiceRoleClient()
    .from("ai_model_configs")
    .select("id,workspace_id")
    .eq("role", role)
    .eq("enabled", true)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("workspace_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  if (error) throw new Error(`Could not resolve ${role} model: ${error.message}`);
  return data.id;
}

async function updateRun(id: string, values: Record<string, unknown>) {
  const { error } = await createServiceRoleClient()
    .from("campaign_runs")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update Campaign Run: ${error.message}`);
}

async function updateExecution(id: string, values: Record<string, unknown>) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update discovery execution: ${error.message}`);
}

async function appendEvent(
  context: { workspaceId: string; runId: string },
  eventType: string,
  phase: string,
  summary: string,
  details: Record<string, unknown> = {},
  level: "info" | "error" = "info",
) {
  const { error } = await createServiceRoleClient().from("campaign_run_events").insert({
    workspace_id: context.workspaceId,
    campaign_run_id: context.runId,
    event_type: eventType,
    phase,
    level,
    summary,
    details,
  });
  if (error) throw new Error(`Could not append Campaign event: ${error.message}`);
}

function mapSellerProfile(value: unknown): LeadEvaluationInput["sellerProfile"] {
  const profile = asRecord(value);
  return {
    companyName: stringValue(profile.company_name) || stringValue(profile.companyName),
    productsAndServices: stringArray(
      profile.products_and_services ?? profile.productsAndServices,
    ),
    customerTypes: stringArray(profile.customer_types ?? profile.customerTypes),
    capabilities: stringArray(profile.capabilities),
    differentiators: stringArray(profile.differentiators),
    claims: stringArray(profile.claims),
    limitations: stringArray(profile.limitations),
    summary: stringValue(profile.summary),
  } satisfies Pick<
    CompanyProfile,
    | "companyName"
    | "productsAndServices"
    | "customerTypes"
    | "capabilities"
    | "differentiators"
    | "claims"
    | "limitations"
    | "summary"
  >;
}

function positiveInteger(primary: unknown, fallback: unknown) {
  const value = Number(primary ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : 25;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function candidateKey(result: { query: string; url: string }) {
  return hash({
    query: result.query.trim().toLowerCase(),
    url: normalizedUrl(result.url),
  });
}

function candidateIdentityKey(
  result: { title: string; url: string },
  countryRegion: string,
) {
  return (
    normalizedDomain(result.url) ||
    normalizedUrl(result.url) ||
    `${normalizeNameKey(result.title)}|${countryRegion.trim().toLowerCase()}`
  );
}

function origin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function normalizedUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function normalizedDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeName(value: string) {
  return value.trim().slice(0, 180) || "Unknown company";
}

function normalizeNameKey(value: string) {
  return normalizeName(value).toLowerCase().replace(/\s+/g, " ");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

function asDiscoveryResult(value: unknown): CampaignDiscoveryResult | null {
  const result = asRecord(value);
  const queriesExecuted = stringArray(result.queriesExecuted);
  const numericFields = [
    "discoveredCount",
    "failedCount",
    "inspectedCount",
    "iterationNumber",
    "qualifiedCount",
    "rejectedCount",
    "totalDiscoveredCount",
    "totalQualifiedCount",
  ] as const;
  if (
    typeof result.decision !== "string" ||
    !numericFields.every((field) => typeof result[field] === "number")
  )
    return null;
  return {
    decision: result.decision,
    queriesExecuted,
    ...Object.fromEntries(numericFields.map((field) => [field, result[field]])),
  } as CampaignDiscoveryResult;
}
