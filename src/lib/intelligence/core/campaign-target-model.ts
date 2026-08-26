import { z } from "zod";
import { intelligenceRuleSchema } from "../contracts/rules.ts";
import { commercialRelationshipTypeSchema } from "./commercial-intelligence.ts";
import {
  confidenceSchema,
  geographyScopeSchema,
  referenceIdSchema,
  signalSchema,
  unknownSchema,
} from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const targetArchetypeSchema = z
  .object({
    id: referenceIdSchema,
    label: z.string().min(1).max(200),
    organizationType: z.string().min(1).max(300),
    businessModel: z.array(z.string().min(1).max(240)).default([]),
    priority: z.enum(["priority", "secondary", "exploratory", "incompatible"]),
    whyItCanBuyOrUse: z.string().min(1).max(1200),
    operationalEvidenceOfNeed: z.array(z.string().min(1).max(500)).min(1),
    positiveSignals: z.array(signalSchema).default([]),
    negativeSignals: z.array(signalSchema).default([]),
    scaleSignals: z.array(signalSchema).default([]),
    geographyRequirements: z.array(z.string().min(1).max(500)).default([]),
    hardExclusionRuleKeys: z.array(referenceIdSchema).default([]),
    likelyRelationships: z.array(commercialRelationshipTypeSchema).min(1),
    optionalOrUnknown: z.array(unknownSchema).default([]),
    evidenceIds: z.array(referenceIdSchema).max(50).default([]),
    confidence: confidenceSchema,
  })
  .strict();

export const campaignTargetModelSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    profileSnapshotId: referenceIdSchema,
    commercialIntelligenceVersionId: referenceIdSchema,
    offeringIds: z.array(referenceIdSchema).min(1),
    objective: z
      .object({
        code: referenceIdSchema,
        description: z.string().min(1).max(1000),
        desiredRelationships: z.array(commercialRelationshipTypeSchema).min(1),
      })
      .strict(),
    geography: geographyScopeSchema,
    archetypes: z.array(targetArchetypeSchema).min(1),
    requiredSignals: z.array(signalSchema).default([]),
    positiveSignals: z.array(signalSchema).default([]),
    negativeSignals: z.array(signalSchema).default([]),
    hardExclusions: z.array(intelligenceRuleSchema).default([]),
    softExclusions: z.array(intelligenceRuleSchema).default([]),
    qualificationRequirements: z.array(unknownSchema).default([]),
    confirmedConstraints: z.array(z.string().min(1).max(800)).default([]),
    unresolvedQuestions: z.array(unknownSchema).default([]),
    confidence: confidenceSchema,
    version: intelligenceArtifactVersionSchema,
  })
  .strict()
  .superRefine((target, context) => {
    if (!target.archetypes.some(({ priority }) => priority === "priority")) {
      context.addIssue({
        code: "custom",
        path: ["archetypes"],
        message: "A target model requires at least one priority archetype.",
      });
    }
    if (
      target.hardExclusions.some(
        (rule) => rule.ruleType !== "hard_exclusion" || rule.strength !== "hard",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["hardExclusions"],
        message: "Hard exclusions must contain only hard-exclusion rules.",
      });
    }
    if (target.softExclusions.some((rule) => rule.ruleType !== "soft_exclusion")) {
      context.addIssue({
        code: "custom",
        path: ["softExclusions"],
        message: "Soft exclusions must contain only soft-exclusion rules.",
      });
    }
  });

export type TargetArchetype = z.infer<typeof targetArchetypeSchema>;
export type CampaignTargetModel = z.infer<typeof campaignTargetModelSchema>;
