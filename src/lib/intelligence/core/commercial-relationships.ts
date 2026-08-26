import { z } from "zod";
import { commercialRelationshipTypeSchema } from "./commercial-intelligence.ts";
import { confidenceSchema, referenceIdSchema } from "./shared.ts";
import { intelligenceArtifactVersionSchema } from "./versioning.ts";

export const commercialRelationshipDimensionSchema = z
  .object({
    state: z.enum(["confirmed", "probable", "possible", "unlikely", "unknown"]),
    confidence: confidenceSchema,
    evidenceIds: z.array(referenceIdSchema).default([]),
    counterEvidenceIds: z.array(referenceIdSchema).default([]),
    unresolvedQuestions: z.array(z.string().min(1).max(500)).default([]),
    rationale: z.string().min(1).max(800),
  })
  .strict()
  .superRefine((assessment, context) => {
    if (assessment.state === "unknown" && assessment.confidence !== 0) {
      context.addIssue({
        code: "custom",
        path: ["confidence"],
        message: "Unknown relationships must have zero confidence.",
      });
    }
    if (
      ["confirmed", "probable", "unlikely"].includes(assessment.state) &&
      assessment.evidenceIds.length === 0 &&
      assessment.counterEvidenceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "Decisive relationship states require evidence or counter-evidence.",
      });
    }
  });

export const commercialRelationshipAssessmentSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    organizationId: referenceIdSchema,
    companyIntelligenceVersionId: referenceIdSchema,
    campaignTargetModelVersionId: referenceIdSchema,
    relationships: z.partialRecord(
      commercialRelationshipTypeSchema,
      commercialRelationshipDimensionSchema,
    ),
    version: intelligenceArtifactVersionSchema,
  })
  .strict();

export type CommercialRelationshipDimension = z.infer<
  typeof commercialRelationshipDimensionSchema
>;
export type CommercialRelationshipAssessment = z.infer<
  typeof commercialRelationshipAssessmentSchema
>;
