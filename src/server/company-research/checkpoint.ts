import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ResearchBudgetState } from "@/lib/credits/contracts";
import {
  companyResearchQuoteSchema,
  type CampaignComplexity,
} from "@/lib/company-research/outcome-pricing";

export type CompanyResearchCheckpoint = {
  status:
    | "active"
    | "internal_guard"
    | "paused"
    | "paused_workspace_balance"
    | "current_pool_complete"
    | "partial_complete"
    | "complete"
    | "failed"
    | "stopped";
  pauseReason: string | null;
  completionReason: string | null;
  pricingComplexity: CampaignComplexity;
  quotedResearchCredits: number;
  requestedCompanyCount: number;
  counts: {
    discovered: number;
    resolved: number;
    researching: number;
    qualified: number;
    rejected: number;
    pending: number;
    reviewed: number;
  };
  pendingEstimate: {
    minimumCredits: number;
    expectedCredits: number;
    maximumCredits: number;
    observedCandidates: number;
  } | null;
};

export async function getCompanyResearchCheckpoint(input: {
  workspaceId: string;
  campaignRunId: string;
  budget: ResearchBudgetState;
}): Promise<CompanyResearchCheckpoint> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select(
      "campaign_id,strategy_version_id,status,current_phase,research_pause_reason,metadata,requested_company_count,delivered_company_count,outcome_state,completion_reason,outcome_quote_json,quoted_research_credits",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not load research checkpoint: ${runError.message}`);

  const [candidateResult, batchResult, usageResult, workflowResult] = await Promise.all([
    supabase
      .from("campaign_candidates")
      .select("id,state,display_organization_id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", run.campaign_id)
      .eq("campaign_strategy_version_id", run.strategy_version_id),
    supabase
      .from("candidate_qualification_batches_v2")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId),
    supabase
      .from("usage_ledger")
      .select("company_id,opptium_credits")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .eq("entry_type", "settlement")
      .not("company_id", "is", null),
    supabase
      .from("intelligence_workflow_runs")
      .select("status,error_summary_json")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const error =
    candidateResult.error ??
    batchResult.error ??
    usageResult.error ??
    workflowResult.error;
  if (error) throw new Error(`Could not derive research checkpoint: ${error.message}`);

  const batchIds = (batchResult.data ?? []).map(({ id }) => id);
  const memberResult = batchIds.length
    ? await supabase
        .from("candidate_qualification_batch_members_v2")
        .select("campaign_candidate_id,status,output_reference_json")
        .eq("workspace_id", input.workspaceId)
        .in("candidate_qualification_batch_id", batchIds)
    : { data: [], error: null };
  if (memberResult.error)
    throw new Error(`Could not derive candidate progress: ${memberResult.error.message}`);

  const candidates = candidateResult.data ?? [];
  const validCandidates = candidates.filter(
    ({ state }) => !["invalid", "merged", "archived"].includes(state),
  );
  const terminalLaneByCandidate = new Map<string, string>();
  const activelyResearching = new Set<string>();
  for (const member of memberResult.data ?? []) {
    if (["queued", "running"].includes(member.status)) {
      activelyResearching.add(member.campaign_candidate_id);
    }
    const output = objectValue(member.output_reference_json);
    const lane = typeof output.lane === "string" ? output.lane : null;
    if (member.status === "completed" && lane) {
      terminalLaneByCandidate.set(member.campaign_candidate_id, lane);
    }
  }
  const qualified = run.delivered_company_count;
  const rejected = [...terminalLaneByCandidate.values()].filter((lane) =>
    ["rejected", "excluded", "invalid", "duplicate"].includes(lane),
  ).length;
  const researching = new Set([
    ...activelyResearching,
    ...validCandidates
      .filter(({ state }) =>
        [
          "research_planned",
          "researching",
          "research_blocked",
          "ready_for_evaluation",
        ].includes(state),
      )
      .map(({ id }) => id),
  ]).size;
  const reviewed = qualified + rejected;
  const pending = Math.max(0, validCandidates.length - reviewed - researching);

  const companyUsage = usageResult.data ?? [];
  const observedCompanies = new Set(
    companyUsage.flatMap(({ company_id }) => (company_id ? [company_id] : [])),
  ).size;
  const observedCredits = companyUsage.reduce(
    (sum, row) => sum + Number(row.opptium_credits ?? 0),
    0,
  );
  const pendingWork = pending + researching;
  const expected =
    observedCompanies >= 3 && observedCredits > 0 && pendingWork > 0
      ? (observedCredits / observedCompanies) * pendingWork
      : null;
  const pendingEstimate =
    expected === null
      ? null
      : {
          minimumCredits: rounded(expected * 0.8),
          expectedCredits: rounded(expected),
          maximumCredits: rounded(expected * 1.25),
          observedCandidates: observedCompanies,
        };

  const workflowError = objectValue(workflowResult.data?.error_summary_json);
  const requestedCompanyCount = run.requested_company_count;
  const quote = companyResearchQuoteSchema.parse(run.outcome_quote_json);
  const workflowErrorMessage =
    typeof workflowError.message === "string" ? workflowError.message : "";
  const effectivePauseReason =
    run.research_pause_reason ??
    (/workspace credit balance|workspace balance/i.test(workflowErrorMessage)
      ? "workspace_balance"
      : /research budget|research credit authorization|campaign research credit/i.test(
            workflowErrorMessage,
          )
        ? "campaign_budget"
        : null);
  return {
    status: checkpointStatus({
      pauseReason: effectivePauseReason,
      pendingWork,
      qualified,
      requestedCompanyCount,
      outcomeState: run.outcome_state,
      runStatus: run.status,
      workflowStatus: workflowResult.data?.status ?? null,
    }),
    pauseReason: effectivePauseReason,
    completionReason: run.completion_reason,
    pricingComplexity: quote.complexity,
    quotedResearchCredits: run.quoted_research_credits ?? quote.authorizedCredits,
    requestedCompanyCount,
    counts: {
      discovered: candidates.length,
      resolved: validCandidates.length,
      researching,
      qualified,
      rejected,
      pending,
      reviewed,
    },
    pendingEstimate,
  };
}

function checkpointStatus(input: {
  pauseReason: string | null;
  pendingWork: number;
  runStatus: string;
  workflowStatus: string | null;
  qualified: number;
  requestedCompanyCount: number;
  outcomeState: string;
}): CompanyResearchCheckpoint["status"] {
  if (input.outcomeState === "target_reached") return "complete";
  if (input.outcomeState === "partial_complete") return "partial_complete";
  if (input.outcomeState === "stopped") return "stopped";
  if (input.outcomeState === "failed") return "failed";
  if (input.qualified >= input.requestedCompanyCount) return "complete";
  if (input.pauseReason === "workspace_balance") return "paused_workspace_balance";
  if (input.pauseReason === "campaign_budget") return "internal_guard";
  if (input.workflowStatus === "paused") return "paused";
  if (["completed", "partially_completed"].includes(input.runStatus)) return "complete";
  if (["cancelled", "failed"].includes(input.runStatus)) return "stopped";
  if (input.workflowStatus === "ready_for_review" && input.pendingWork === 0)
    return "current_pool_complete";
  return "active";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rounded(value: number) {
  return Math.ceil(value * 10) / 10;
}
