import { z } from "zod";
import { intelligenceMemorySchema } from "../intelligence/contracts/memory.ts";

export const memoryRetrievalContextSchema = z
  .object({
    workspaceId: z.string().min(1),
    userId: z.string().min(1).optional(),
    offeringIds: z.array(z.string()).default([]),
    campaignId: z.string().min(1).optional(),
    candidateId: z.string().min(1).optional(),
    runId: z.string().min(1).optional(),
    objectiveCode: z.string().min(1).optional(),
    geographyCodes: z.array(z.string()).default([]),
    archetypeIds: z.array(z.string()).default([]),
    relationshipTypes: z.array(z.string()).default([]),
    qualificationFactorKeys: z.array(z.string()).default([]),
    now: z.iso.datetime(),
  })
  .strict();

export const excludedMemorySchema = z
  .object({
    memoryId: z.string().min(1),
    reason: z.enum([
      "wrong_scope",
      "wrong_objective",
      "wrong_offering",
      "wrong_geography",
      "wrong_archetype",
      "wrong_candidate",
      "wrong_relationship",
      "wrong_factor",
      "unknown_applicability",
      "superseded",
      "expired",
      "unconfirmed",
    ]),
  })
  .strict();

export const resolvedMemorySetSchema = z
  .object({
    applied: z.array(intelligenceMemorySchema),
    overridden: z.array(intelligenceMemorySchema),
    excluded: z.array(excludedMemorySchema),
    conflicts: z.array(
      z
        .object({
          winnerId: z.string(),
          overriddenId: z.string(),
          reason: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export const memoryPromotionProposalSchema = z
  .object({
    id: z.string().min(1),
    sourceMemoryIds: z.array(z.string()).min(1),
    currentScope: z.enum(["campaign", "offering"]),
    proposedScope: z.enum(["offering", "workspace"]),
    proposedScopeId: z.string().min(1),
    proposedStatement: z.string().min(1),
    proposedApplicability: intelligenceMemorySchema.shape.applicability,
    rationale: z.string().min(1),
    supportingCampaignIds: z.array(z.string()),
    supportingEvidenceIds: z.array(z.string()),
    recurrenceCount: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    status: z.enum(["pending", "accepted", "rejected", "deferred"]),
  })
  .strict();

export type MemoryRetrievalContext = z.infer<typeof memoryRetrievalContextSchema>;
export type ResolvedMemorySet = z.infer<typeof resolvedMemorySetSchema>;
export type MemoryPromotionProposal = z.infer<typeof memoryPromotionProposalSchema>;
