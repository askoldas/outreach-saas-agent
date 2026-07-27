import { z } from "zod";

export const aiTaskContractVersionSchema = z
  .object({
    taskId: z.string().min(1),
    promptVersion: z.string().min(1),
    schemaVersion: z.string().min(1),
    contextCompilerVersion: z.string().min(1),
  })
  .strict();

export type AiTaskContractVersion = z.infer<typeof aiTaskContractVersionSchema>;

export const aiTaskExecutionSchema = z
  .object({
    workspaceId: z.string().min(1),
    campaignId: z.string().optional(),
    campaignRunId: z.string().optional(),
    campaignCompanyId: z.string().optional(),
    companyProfileVersionId: z.string().optional(),
    campaignStrategyVersionId: z.string().optional(),
    providerExecutionId: z.string().optional(),
    correlationId: z.string().min(1),
    requestedAt: z.iso.datetime(),
  })
  .strict();

export function createAiTaskRequestSchema<
  TContext extends z.ZodType,
  TPayload extends z.ZodType,
>(context: TContext, payload: TPayload) {
  return z
    .object({
      task: aiTaskContractVersionSchema,
      execution: aiTaskExecutionSchema,
      context,
      payload,
      constraints: z
        .object({
          maxItems: z.number().int().positive().optional(),
          maxEvidenceItems: z.number().int().positive().optional(),
          locale: z.string().optional(),
          outputLanguage: z.string().optional(),
        })
        .strict(),
    })
    .strict();
}

export type AiTaskResult<T> = {
  data: T;
  diagnostics: {
    warnings: string[];
    unknownCount: number;
    conflictCount: number;
    evidenceReferenceCount: number;
    omittedItemCount: number;
  };
  provenance: AiTaskContractVersion & {
    requestedModel: string;
    actualModel: string;
    fallbackUsed: boolean;
    requestHash: string;
    responseHash: string;
  };
};

export type IntelligenceV2ModelRole =
  | "profile_fact_extraction"
  | "profile_commercial_reasoning"
  | "profile_consistency"
  | "campaign_strategy_reasoning"
  | "market_analysis"
  | "discovery_query_compilation"
  | "candidate_classification"
  | "organization_extraction"
  | "entity_resolution_reasoning"
  | "candidate_research_planning"
  | "candidate_evidence_extraction"
  | "candidate_relationship_reasoning"
  | "candidate_factor_evaluation"
  | "candidate_verification"
  | "comparative_ranking"
  | "memory_reasoning"
  | "guided_interpretation"
  | "contact_extraction"
  | "outreach_generation"
  | "low_risk_transformation";
