import { z } from "zod";
import { parseCompleteJsonObject } from "../../lib/ai/structured-json.ts";
import {
  marketResearchWaveSummarySchema,
  sanitizeMarketResearchWaveSummary,
  type CampaignTargetModel,
  type MarketEvidenceCorpus,
  type MarketResearchWaveSummary,
} from "../../lib/intelligence/core/index.ts";
import { generateTextResult } from "../../lib/providers/openrouter.ts";
import { runBudgetedOpenRouterCall } from "../credits/budgeted-provider-call.ts";

export async function reasonAboutWaveOne(input: {
  workspaceId: string;
  campaignRunId: string;
  target: CampaignTargetModel;
  evidence: MarketEvidenceCorpus["evidence"];
}): Promise<MarketResearchWaveSummary> {
  const visible = [...input.evidence]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) || a.id.localeCompare(b.id))
    .slice(0, 24);
  const allowedEvidenceIds = new Set(visible.map(({ id }) => id));
  const call = await runBudgetedOpenRouterCall({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    operation: "company_research.market_wave_one_reasoning",
    idempotencyKey: `market-wave-one-reasoning:${input.campaignRunId}`,
    execute: () => generateTextResult([
      {
        role: "system",
        content: `Analyze only the supplied Wave-1 market evidence. Return structured JSON. Preserve evidence IDs and distinguish supported observations from hypotheses through rationale and confidence. New buyer lanes must stay within the exact offering, geography, objective and approved relationship types. Record useful out-of-bound relationships as weakened observations, never as discovered active lanes. Do not alter geography or offering. Schema: ${JSON.stringify(z.toJSONSchema(marketResearchWaveSummarySchema))}`,
      },
      { role: "user", content: JSON.stringify({ target: input.target, waveOneEvidence: visible }) },
    ], {
      role: "campaign_strategy_compilation",
      maxCompletionTokens: 1_500,
      reasoningEffort: "minimal",
      taskName: "market Wave-1 reasoning",
      jsonSchema: {
        name: "market_wave_one_summary",
        schema: z.toJSONSchema(marketResearchWaveSummarySchema) as Record<string, unknown>,
        strict: true,
      },
    }),
  });
  const parsed = parseCompleteJsonObject(call.data);
  const summary = marketResearchWaveSummarySchema.parse(parsed ?? call.data);
  return sanitizeMarketResearchWaveSummary(summary, allowedEvidenceIds, new Set(input.target.objective.desiredRelationships));
}
