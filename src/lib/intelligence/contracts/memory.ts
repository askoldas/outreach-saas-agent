import { z } from "zod";

export const memoryEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hard_exclusion"), rule: z.unknown() }).strict(),
  z.object({ type: z.literal("soft_exclusion"), condition: z.unknown() }).strict(),
  z.object({ type: z.literal("required_condition"), condition: z.unknown() }).strict(),
  z.object({ type: z.literal("preferred_condition"), condition: z.unknown() }).strict(),
  z
    .object({
      type: z.literal("query_term_include"),
      terms: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("query_term_exclude"),
      terms: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("source_preference"),
      sourceTypes: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("organization_alias"),
      organizationId: z.string().min(1),
      canonicalName: z.string().min(1),
      aliases: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("relationship_correction"),
      relationshipType: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("entity_resolution_correction"),
      action: z
        .object({
          type: z.literal("canonical_identity"),
          matchNames: z.array(z.string().min(1)).min(1),
          canonicalName: z.string().min(1),
          canonicalDomain: z.string().min(1).optional(),
        })
        .strict(),
    })
    .strict(),
]);

export const intelligenceMemorySchema = z
  .object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    userId: z.string().min(1).optional(),
    scope: z.enum(["user", "workspace", "offering", "campaign", "candidate", "run"]),
    scopeId: z.string().min(1),
    kind: z.enum([
      "fact",
      "preference",
      "exclusion",
      "correction",
      "strategy_pattern",
      "market_finding",
      "discovery_lesson",
      "evaluation_lesson",
      "hypothesis",
    ]),
    statement: z.string().min(1).max(1200),
    effect: memoryEffectSchema.optional(),
    applicability: z
      .object({
        objectiveCodes: z.array(z.string()).optional(),
        offeringIds: z.array(z.string()).optional(),
        geographyCodes: z.array(z.string()).optional(),
        archetypeIds: z.array(z.string()).optional(),
        candidateIds: z.array(z.string()).optional(),
        relationshipTypes: z.array(z.string()).optional(),
        qualificationFactorKeys: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    applicabilityStatus: z.enum(["known", "unknown"]).optional(),
    strength: z.enum(["hard", "soft"]),
    status: z.enum([
      "proposed",
      "provisional",
      "confirmed",
      "rejected",
      "superseded",
      "expired",
      "archived",
    ]),
    source: z.enum(["user", "ai", "system", "import"]),
    confidence: z.number().min(0).max(1),
    originCampaignId: z.string().optional(),
    originRunId: z.string().optional(),
    originCandidateId: z.string().optional(),
    originType: z.string().min(1).optional(),
    originId: z.string().optional(),
    supersedesMemoryId: z.string().optional(),
    createdByUserId: z.string().optional(),
    recordVersion: z.string().min(1).optional(),
    evidenceIds: z.array(z.string()),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    lastAppliedAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export type IntelligenceMemory = z.infer<typeof intelligenceMemorySchema>;
export type MemoryEffect = z.infer<typeof memoryEffectSchema>;
