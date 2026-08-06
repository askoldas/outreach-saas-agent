import { z } from "zod";

export const evidenceFreshnessSchema = z.enum(["current", "recent", "stale", "unknown"]);

export const evidenceSourceQualitySchema = z.enum([
  "first_party",
  "authoritative_registry",
  "trusted_directory",
  "reputable_secondary",
  "unverified_secondary",
]);

export const evidenceReferenceSchema = z
  .object({
    evidenceId: z.string().min(1),
    sourceId: z.string().min(1),
    sourceUrl: z.url().optional(),
    sourceType: z.string().min(1),
    retrievedAt: z.iso.datetime(),
    excerpt: z.string().max(800).optional(),
    freshness: evidenceFreshnessSchema,
    sourceQuality: evidenceSourceQualitySchema,
  })
  .strict();

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
