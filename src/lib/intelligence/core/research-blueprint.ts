import { z } from "zod";
import { sourceRoleSchema } from "./organization-reference.ts";
import { referenceIdSchema } from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const researchBlueprintSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    targetArchetypeId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    marketAnalysisVersionId: referenceIdSchema,
    researchQuestions: z
      .array(
        z
          .object({
            key: referenceIdSchema,
            question: z.string().min(1).max(700),
            required: z.boolean(),
            priority: z.number().int().min(0).max(100),
            evidenceRoles: z.array(sourceRoleSchema).min(1),
          })
          .strict(),
      )
      .min(1),
    preferredSourceTypes: z.array(z.string().min(1).max(120)).min(1),
    requiredEvidenceDimensions: z.array(referenceIdSchema).default([]),
    optionalEvidenceDimensions: z.array(referenceIdSchema).default([]),
    operationalSignals: z.array(referenceIdSchema).default([]),
    exclusionChecks: z.array(referenceIdSchema).default([]),
    stoppingCriteria: z
      .object({
        minimumRequiredCoverage: z.number().min(0).max(1),
        maximumFirstPartyPages: z.number().int().positive(),
        maximumSupportingSources: z.number().int().nonnegative(),
        stopWhenCriticalUnknownsResolved: z.boolean(),
      })
      .strict(),
    version: intelligenceArtifactVersionSchema,
  })
  .strict();

export type ResearchBlueprint = z.infer<typeof researchBlueprintSchema>;
