import { z } from "zod";
import { providerSourceTypeSchema } from "../../discovery-v2/contracts.ts";
import { confidenceSchema, referenceIdSchema } from "./shared.ts";

export const sourceRoleSchema = z.enum([
  "discovery",
  "identity",
  "first_party",
  "supporting",
  "qualification",
]);

export const organizationReferenceSchema = z
  .object({
    id: referenceIdSchema,
    workspaceId: referenceIdSchema,
    campaignId: referenceIdSchema,
    sourceRecordId: referenceIdSchema,
    providerExecutionId: referenceIdSchema,
    providerId: referenceIdSchema,
    sourceType: providerSourceTypeSchema,
    sourceUrl: z.url().optional(),
    sourceRoles: z.array(sourceRoleSchema).min(1),
    organizationName: z.string().min(1).max(300),
    normalizedName: z.string().min(1).max(300).optional(),
    websiteHint: z.url().optional(),
    domainHint: z.string().min(3).max(253).optional(),
    geographyHints: z.array(z.string().min(1).max(240)).default([]),
    organizationTypeHints: z.array(z.string().min(1).max(160)).default([]),
    businessTypeHints: z.array(z.string().min(1).max(240)).default([]),
    matchedArchetypeIds: z.array(referenceIdSchema).default([]),
    matchedSegmentIds: z.array(referenceIdSchema).default([]),
    matchedSignals: z.array(referenceIdSchema).default([]),
    provenance: z
      .object({
        extractionMethod: z.string().min(1).max(120),
        extractionVersion: z.string().min(1).max(120),
        sourceOrdinal: z.number().int().nonnegative().optional(),
        queryFingerprint: z.string().min(1).optional(),
        retrievedAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    confidence: confidenceSchema,
  })
  .strict()
  .superRefine((reference, context) => {
    if (reference.sourceRoles.includes("first_party") && !reference.websiteHint) {
      context.addIssue({
        code: "custom",
        path: ["websiteHint"],
        message: "First-party references require a website hint.",
      });
    }
    if (
      reference.websiteHint &&
      reference.sourceUrl &&
      reference.websiteHint === reference.sourceUrl &&
      reference.sourceRoles.includes("discovery") &&
      !reference.sourceRoles.includes("first_party")
    ) {
      context.addIssue({
        code: "custom",
        path: ["websiteHint"],
        message:
          "A discovery source URL cannot become an organization website without first-party identity evidence.",
      });
    }
  });

export type SourceRole = z.infer<typeof sourceRoleSchema>;
export type OrganizationReference = z.infer<typeof organizationReferenceSchema>;
