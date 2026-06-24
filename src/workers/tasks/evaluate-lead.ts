import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateLeadSourceWithAi,
  type LeadEvaluation,
  type LeadEvaluationInput,
} from "../../lib/ai/lead-evaluation.ts";
import { requireOpenRouterConfig } from "../../lib/providers/config.ts";
import type { SearchResult } from "../../lib/providers/tavily.ts";
import { updateRunStep } from "../lib/task-status.ts";
import type { ResearchTaskRow } from "../lib/claim-task.ts";

type EvaluationPayload = {
  source: SearchResult & {
    classification?: unknown;
    query: string;
    sourceId?: string;
  };
};

type CampaignRow = {
  external_id: string;
  geography: string;
  industry_terms?: string[] | null;
  language: string;
  objective: string;
  offer_external_id: string;
  strategy_criteria: string[];
  strategy_exclusions: string[];
  strategy_terms: string[];
  target_segments: string[];
};

type OfferRow = {
  buyer_types: string[];
  capabilities: string[];
  differentiators: string[];
  external_id: string;
  keywords: string[];
  limitations: string[];
  name: string;
  problems: string[];
  summary: string;
  type: string;
};

export async function processEvaluateLeadTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Evaluating lead", 50);
  const payload = parsePayload(task);
  const campaign = await loadCampaign(supabase, task);
  const offer = await loadOffer(supabase, task.workspace_id, campaign.offer_external_id);
  const input = buildEvaluationInput(campaign, offer, payload);
  const model = requireOpenRouterConfig().model;

  try {
    const result = await evaluateLeadSourceWithAi(input);
    await logAiGeneration(supabase, task, {
      errorMessage: "",
      model,
      outputJson: result.evaluation,
      outputText: result.rawOutput,
      promptJson: result.promptInput,
      promptVersion: result.promptVersion,
      status: "completed",
    });

    if (result.evaluation.qualificationStatus !== "disqualified") {
      const lead = await saveEvaluatedLead(supabase, task, payload.source, result.evaluation);
      await enqueueContactEnrichmentTask(supabase, task, payload.source, lead);
    } else if (payload.source.sourceId) {
      await updateLeadSourceEvaluation(supabase, payload.source.sourceId, result.evaluation);
    }

    return {
      companyName: result.evaluation.companyName,
      qualificationStatus: result.evaluation.qualificationStatus,
      relevanceScore: result.evaluation.relevanceScore,
    };
  } catch (error) {
    await logAiGeneration(supabase, task, {
      errorMessage: error instanceof Error ? error.message : "Lead evaluation failed",
      model,
      outputJson: null,
      outputText: "",
      promptJson: input,
      promptVersion: "lead-evaluator-v1",
      status: "failed",
    });
    const lead = await saveLeadForAiFailure(supabase, task, payload.source, error);
    await enqueueContactEnrichmentTask(supabase, task, payload.source, lead);

    return {
      companyName: lead.companyName,
      error: error instanceof Error ? error.message : "Lead evaluation failed",
      qualificationStatus: "failed",
      relevanceScore: lead.fitScore,
    };
  }
}

function buildEvaluationInput(
  campaign: CampaignRow,
  offer: OfferRow | null,
  payload: EvaluationPayload,
): LeadEvaluationInput {
  return {
    campaign: {
      geography: campaign.geography,
      industryTerms: campaign.industry_terms ?? [],
      language: campaign.language,
      objective: campaign.objective,
      strategy: {
        criteria: campaign.strategy_criteria,
        exclusions: campaign.strategy_exclusions,
        terms: campaign.strategy_terms,
      },
      targetSegments: campaign.target_segments,
    },
    offer: offer
      ? {
          buyerTypes: offer.buyer_types,
          capabilities: offer.capabilities,
          differentiators: offer.differentiators,
          keywords: offer.keywords,
          limitations: offer.limitations,
          name: offer.name,
          problems: offer.problems,
          summary: offer.summary,
          type: offer.type as LeadEvaluationInput["offer"] extends infer T
            ? T extends { type: infer U }
              ? U
              : never
            : never,
        }
      : null,
    source: {
      classification: JSON.stringify(payload.source.classification ?? {}),
      content: payload.source.content,
      query: payload.source.query,
      rejectionReason: null,
      title: payload.source.title,
      url: payload.source.url,
    },
  };
}

async function loadCampaign(supabase: SupabaseClient, task: ResearchTaskRow) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `
        external_id,
        objective,
        geography,
        target_segments,
        language,
        strategy_terms,
        strategy_criteria,
        strategy_exclusions,
        industry_terms,
        offer_external_id
      `,
    )
    .eq("workspace_id", task.workspace_id)
    .eq("external_id", task.campaign_id)
    .single();

  if (error) {
    throw new Error(`Could not load campaign for lead evaluation: ${error.message}`);
  }

  return data as CampaignRow;
}

async function loadOffer(
  supabase: SupabaseClient,
  workspaceId: string,
  offerExternalId: string,
) {
  const { data, error } = await supabase
    .from("offers")
    .select(
      `
        external_id,
        name,
        type,
        summary,
        problems,
        capabilities,
        buyer_types,
        differentiators,
        limitations,
        keywords
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("external_id", offerExternalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load offer for lead evaluation: ${error.message}`);
  }

  return data ? (data as OfferRow) : null;
}

async function logAiGeneration(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  input: {
    errorMessage: string;
    model: string;
    outputJson: LeadEvaluation | null;
    outputText: string;
    promptJson: unknown;
    promptVersion: string;
    status: "completed" | "failed";
  },
) {
  const { error } = await supabase.from("ai_generations").insert({
    campaign_id: task.campaign_id,
    completed_at: new Date().toISOString(),
    error_message: input.errorMessage || null,
    model: input.model,
    output_json: input.outputJson,
    output_text: input.outputText,
    prompt_json: input.promptJson,
    prompt_version: input.promptVersion,
    provider: "openrouter",
    run_id: task.run_id,
    status: input.status,
    task_id: task.id,
    task_name: "evaluate_lead",
    workspace_id: task.workspace_id,
  });

  if (error) {
    throw new Error(`Could not log AI generation: ${error.message}`);
  }
}

async function saveEvaluatedLead(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  source: EvaluationPayload["source"],
  evaluation: LeadEvaluation,
) {
  const externalId = createDiscoveredLeadId(evaluation.website ?? source.url, evaluation.companyName ?? source.title);
  const website = evaluation.website ?? getOrigin(source.url);
  const { data, error } = await supabase
    .from("leads")
    .upsert(
      {
        campaign_id: task.campaign_id,
        city: evaluation.city ?? "Unknown",
        company: normalizeCompanyName(evaluation.companyName ?? source.title),
        company_type: evaluation.companyType ?? "Company",
        confidence: evaluation.confidence,
        contactability: evaluation.contactability,
        country: evaluation.country ?? "Unknown",
        description: evaluation.summary,
        estimated_size: "Unknown",
        external_id: externalId,
        fit_score: evaluation.relevanceScore,
        industry: evaluation.industry ?? "Unknown",
        qualification_error:
          evaluation.qualificationStatus === "needs_review"
            ? evaluation.missingInfo.join("; ").slice(0, 1000)
            : null,
        qualification_status:
          evaluation.qualificationStatus === "qualified"
            ? "qualified"
            : "needs_manual_review",
        status: "needs_review",
        summary: evaluation.summary,
        website,
        workspace_id: task.workspace_id,
      },
      { onConflict: "workspace_id,external_id" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Could not save AI-evaluated lead: ${error.message}`);
  }

  const leadId = (data as { id: string }).id;
  await replaceLeadEvidenceAndQualification(supabase, leadId, source, evaluation);

  if (source.sourceId) {
    await updateLeadSourceEvaluation(supabase, source.sourceId, evaluation);
  }

  return {
    companyName: evaluation.companyName ?? source.title,
    fitScore: evaluation.relevanceScore,
    leadDatabaseId: leadId,
    leadExternalId: externalId,
    website,
  };
}

async function saveLeadForAiFailure(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  source: EvaluationPayload["source"],
  error: unknown,
) {
  const externalId = createDiscoveredLeadId(source.url, source.title);
  const website = getOrigin(source.url);
  const fitScore = scoreToFit(source.score);
  const errorMessage = sanitizeError(error);
  const { data, error: upsertError } = await supabase
    .from("leads")
    .upsert(
      {
        campaign_id: task.campaign_id,
        city: "Unknown",
        company: normalizeCompanyName(source.title),
        company_type: "Discovered company",
        confidence: "low",
        contactability: "low",
        country: "Unknown",
        description: source.content || source.title,
        estimated_size: "Unknown",
        external_id: externalId,
        fit_score: fitScore,
        industry: "Unqualified web discovery",
        qualification_error: errorMessage,
        qualification_status: "failed",
        status: "needs_review",
        summary:
          source.content ||
          "Discovered from Tavily search. AI qualification failed, so this needs manual review.",
        website,
        workspace_id: task.workspace_id,
      },
      { onConflict: "workspace_id,external_id" },
    )
    .select("id")
    .single();

  if (upsertError) {
    throw new Error(`Could not save lead after AI evaluation failure: ${upsertError.message}`);
  }

  const leadId = (data as { id: string }).id;
  await replaceFailedLeadEvidenceAndQualification(supabase, leadId, source, errorMessage, fitScore);

  if (source.sourceId) {
    await updateLeadSourceEvaluationFailure(supabase, source.sourceId, errorMessage);
  }

  return {
    companyName: source.title,
    fitScore,
    leadDatabaseId: leadId,
    leadExternalId: externalId,
    website,
  };
}

async function enqueueContactEnrichmentTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  source: EvaluationPayload["source"],
  lead: {
    leadDatabaseId: string;
    leadExternalId: string;
    website: string;
  },
) {
  const { error } = await supabase.from("research_tasks").insert({
    campaign_id: task.campaign_id,
    max_attempts: 2,
    payload_json: {
      leadDatabaseId: lead.leadDatabaseId,
      leadExternalId: lead.leadExternalId,
      source: {
        content: source.content,
        query: source.query,
        score: source.score,
        sourceId: source.sourceId,
        title: source.title,
        url: source.url,
      },
      website: lead.website,
    },
    run_id: task.run_id,
    status: "pending",
    task_type: "enrich_contacts",
    workspace_id: task.workspace_id,
  });

  if (error) {
    throw new Error(`Could not enqueue contact enrichment task: ${error.message}`);
  }
}

async function replaceLeadEvidenceAndQualification(
  supabase: SupabaseClient,
  leadId: string,
  source: EvaluationPayload["source"],
  evaluation: LeadEvaluation,
) {
  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    [
      {
        confidence: "medium",
        external_id: "source-evidence",
        kind: "fact",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 0,
        source_label: source.title,
        source_type: "Tavily search result",
        source_url: source.url,
        text: source.content || source.title,
      },
      {
        confidence: evaluation.confidence,
        external_id: "ai-lead-evaluation",
        kind: "inference",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 1,
        source_label: "OpenRouter lead evaluation",
        source_type: "AI lead evaluation",
        source_url: source.url,
        text: [...evaluation.fitReasons, ...evaluation.disqualifyingSignals].join(" "),
      },
    ],
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(`Could not save lead evaluation evidence: ${evidenceError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("lead_qualification_dimensions")
    .delete()
    .eq("lead_id", leadId);

  if (deleteError) {
    throw new Error(`Could not clear lead qualification dimensions: ${deleteError.message}`);
  }

  const dimensions = [
    {
      confidence: evaluation.confidence,
      explanation: evaluation.fitReasons.join("; ") || "AI evaluated campaign fit.",
      label: "Campaign fit",
      score: evaluation.relevanceScore,
    },
    {
      confidence: evaluation.missingInfo.length > 0 ? "low" : "medium",
      explanation:
        evaluation.missingInfo.join("; ") || "Source snippet provided enough context for review.",
      label: "Evidence quality",
      score: evaluation.missingInfo.length > 0 ? 45 : 65,
    },
    {
      confidence: evaluation.contactability,
      explanation: evaluation.suggestedNextAction,
      label: "Contactability",
      score:
        evaluation.contactability === "high"
          ? 75
          : evaluation.contactability === "medium"
            ? 55
            : 30,
    },
  ];
  const { error: dimensionError } = await supabase
    .from("lead_qualification_dimensions")
    .insert(
      dimensions.map((dimension, index) => ({
        ...dimension,
        lead_id: leadId,
        sort_order: index,
      })),
    );

  if (dimensionError) {
    throw new Error(`Could not save lead evaluation dimensions: ${dimensionError.message}`);
  }
}

async function updateLeadSourceEvaluation(
  supabase: SupabaseClient,
  sourceId: string,
  evaluation: LeadEvaluation,
) {
  const { error } = await supabase
    .from("lead_sources")
    .update({
      classification: evaluation.qualificationStatus,
      rejection_reason:
        evaluation.qualificationStatus === "disqualified"
          ? evaluation.disqualifyingSignals.join("; ").slice(0, 1000)
          : null,
      result_json: {
        evaluation,
      },
    })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Could not update lead source evaluation: ${error.message}`);
  }
}

async function updateLeadSourceEvaluationFailure(
  supabase: SupabaseClient,
  sourceId: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from("lead_sources")
    .update({
      classification: "needs_review",
      rejection_reason: null,
      result_json: {
        evaluationError: errorMessage,
      },
    })
    .eq("id", sourceId);

  if (error) {
    throw new Error(`Could not update lead source evaluation failure: ${error.message}`);
  }
}

async function replaceFailedLeadEvidenceAndQualification(
  supabase: SupabaseClient,
  leadId: string,
  source: EvaluationPayload["source"],
  errorMessage: string,
  fitScore: number,
) {
  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    [
      {
        confidence: "medium",
        external_id: "source-evidence",
        kind: "fact",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 0,
        source_label: source.title,
        source_type: "Tavily search result",
        source_url: source.url,
        text: source.content || source.title,
      },
      {
        confidence: "low",
        external_id: "ai-lead-evaluation-failure",
        kind: "unknown",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 1,
        source_label: "OpenRouter lead evaluation",
        source_type: "AI lead evaluation failure",
        source_url: source.url,
        text: `AI qualification failed: ${errorMessage}`,
      },
    ],
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(`Could not save failed lead evidence: ${evidenceError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("lead_qualification_dimensions")
    .delete()
    .eq("lead_id", leadId);

  if (deleteError) {
    throw new Error(`Could not clear failed lead qualification dimensions: ${deleteError.message}`);
  }

  const { error: dimensionError } = await supabase
    .from("lead_qualification_dimensions")
    .insert([
      {
        confidence: "low",
        explanation:
          "AI qualification failed. The lead was preserved from source evidence for manual review.",
        label: "Campaign fit",
        lead_id: leadId,
        score: fitScore,
        sort_order: 0,
      },
      {
        confidence: "medium",
        explanation: "Tavily source evidence was saved before AI qualification.",
        label: "Evidence quality",
        lead_id: leadId,
        score: source.content ? 55 : 40,
        sort_order: 1,
      },
      {
        confidence: "low",
        explanation: "Contact discovery is queued separately from AI qualification.",
        label: "Contactability",
        lead_id: leadId,
        score: 30,
        sort_order: 2,
      },
    ]);

  if (dimensionError) {
    throw new Error(`Could not save failed lead qualification dimensions: ${dimensionError.message}`);
  }
}

function parsePayload(task: ResearchTaskRow): EvaluationPayload {
  const source = task.payload_json.source;

  if (!source || typeof source !== "object") {
    throw new Error("evaluate_lead task missing source payload.");
  }

  return { source: source as EvaluationPayload["source"] };
}

function createDiscoveredLeadId(url: string, title: string) {
  const source = getOrigin(url).replace(/^https?:\/\//, "") || title;
  return `web-${slugify(source)}`.slice(0, 80).replace(/-+$/g, "");
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function normalizeCompanyName(companyName: string) {
  return companyName.trim().slice(0, 180) || "Unknown company";
}

function scoreToFit(score: number | null | undefined) {
  if (typeof score !== "number") {
    return 40;
  }

  return Math.max(30, Math.min(70, Math.round(score * 100)));
}

function sanitizeError(error: unknown) {
  return (error instanceof Error ? error.message : "Lead evaluation failed")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
