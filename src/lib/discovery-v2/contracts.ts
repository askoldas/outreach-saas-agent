import { z } from "zod";
import { discoverySegmentRequestV2Schema } from "../intelligence/campaign-strategy-v2/schemas.ts";

export const providerSourceTypeSchema = z.enum([
  "web_search",
  "company_database",
  "registry",
  "maps",
  "industry_directory",
  "marketplace",
  "funding",
  "jobs",
  "news",
]);

export const providerSupportsSchema = z
  .object({
    countryFilter: z.boolean(),
    regionFilter: z.boolean(),
    localityFilter: z.boolean(),
    languageTargeting: z.boolean(),
    industryFilter: z.boolean(),
    keywordFilter: z.boolean(),
    companySizeFilter: z.boolean(),
    employeeRangeFilter: z.boolean(),
    revenueRangeFilter: z.boolean(),
    technologyFilter: z.boolean(),
    businessModelFilter: z.boolean(),
    ownershipFilter: z.boolean(),
    jobSignalFilter: z.boolean(),
    fundingSignalFilter: z.boolean(),
    pagination: z.boolean(),
    totalCountEstimate: z.boolean(),
    recordFreshness: z.boolean(),
  })
  .strict();

export const discoveryProviderCapabilitiesSchema = z
  .object({
    providerId: z.string().min(1),
    providerVersion: z.string().min(1),
    sourceTypes: z.array(providerSourceTypeSchema).min(1),
    supports: providerSupportsSchema,
    supportedCountries: z.array(z.string()).optional(),
    supportedLanguages: z.array(z.string()).optional(),
    maximumPageSize: z.number().int().positive().optional(),
    rateLimit: z
      .object({
        calls: z.number().int().positive(),
        periodSeconds: z.number().int().positive(),
      })
      .strict()
      .optional(),
    costModel: z
      .object({
        type: z.enum(["free", "per_call", "per_record", "credit", "unknown"]),
        currency: z.string().length(3).optional(),
        estimatedMinorPerCall: z.number().nonnegative().optional(),
        estimatedMinorPerRecord: z.number().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const providerDiscoveryRequestSchema = z
  .object({
    workspaceId: z.string().min(1),
    campaignId: z.string().min(1),
    discoveryPlanId: z.string().min(1),
    segment: discoverySegmentRequestV2Schema,
    cursor: z.string().min(1).optional(),
    pageSize: z.number().int().positive().optional(),
    executionContext: z
      .object({
        passNumber: z.number().int().positive(),
        gapId: z.string().min(1).optional(),
        previousExecutionIds: z.array(z.string()),
        excludedCanonicalKeys: z.array(z.string()),
        previousQueryFingerprints: z.array(z.string()),
      })
      .strict(),
    budget: z
      .object({
        maxResults: z.number().int().positive().optional(),
        maxCalls: z.number().int().positive().optional(),
        maxEstimatedCostMinor: z.number().nonnegative().optional(),
        deadlineAt: z.iso.datetime().optional(),
      })
      .strict(),
  })
  .strict();

export const providerDiscoveryEstimateSchema = z
  .object({
    providerId: z.string().min(1),
    supported: z.boolean(),
    unsupportedConstraints: z.array(z.string()),
    estimatedCalls: z.number().int().nonnegative().optional(),
    estimatedRecords: z.number().int().nonnegative().optional(),
    estimatedCostMinor: z.number().nonnegative().optional(),
    estimatedRuntimeSeconds: z.number().nonnegative().optional(),
    warnings: z.array(z.string()),
  })
  .strict();

export const providerExecutionErrorSchema = z
  .object({
    code: z.enum([
      "timeout",
      "rate_limit",
      "blocked_result",
      "invalid_url",
      "empty_result",
      "malformed_response",
      "duplicate_request",
      "unsupported_constraint",
      "extraction_failure",
      "provider_failure",
    ]),
    message: z.string().min(1),
    retryable: z.boolean(),
    recordReference: z.string().optional(),
  })
  .strict();

export const providerSourceRecordInputSchema = z
  .object({
    sourceRecordKey: z.string().min(1),
    providerRecordId: z.string().min(1).optional(),
    sourceType: providerSourceTypeSchema,
    sourceUrl: z.url().optional(),
    resultRank: z.number().int().positive().optional(),
    queryOrFilterFingerprint: z.string().min(1),
    rawPayload: z.record(z.string(), z.unknown()),
    rawPayloadHash: z.string().length(64),
    retrievedAt: z.iso.datetime(),
    providerPublishedAt: z.iso.datetime().optional(),
    providerUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const normalizedProviderCandidateInputSchema = z
  .object({
    sourceRecordKey: z.string().min(1),
    name: z.string().min(1),
    normalizedName: z.string().min(1).optional(),
    websiteUrl: z.url().optional(),
    canonicalDomainHint: z.string().min(1).optional(),
    sourceUrl: z.url().optional(),
    country: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    locality: z.string().min(1).optional(),
    description: z.string().optional(),
    industries: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    employeeCount: z.number().int().nonnegative().optional(),
    organizationTypeHint: z
      .enum([
        "company",
        "brand",
        "branch",
        "storefront",
        "legal_entity",
        "directory_listing",
        "marketplace_seller",
        "unknown",
      ])
      .optional(),
    matchedSegmentId: z.string().min(1),
    matchedArchetypeId: z.string().min(1),
    matchedSignals: z.array(z.string()),
    preliminaryQuality: z
      .object({
        likelyOperatingOrganization: z.boolean().nullable(),
        likelyTargetGeography: z.boolean().nullable(),
        hasUsableIdentity: z.boolean(),
        confidence: z.number().min(0).max(1),
      })
      .strict(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const providerDiscoveryResponseSchema = z
  .object({
    providerId: z.string().min(1),
    executionId: z.string().min(1),
    records: z.array(providerSourceRecordInputSchema),
    normalizedCandidates: z.array(normalizedProviderCandidateInputSchema),
    nextCursor: z.string().min(1).optional(),
    exhausted: z.boolean(),
    usage: z
      .object({
        calls: z.number().int().nonnegative(),
        recordsReturned: z.number().int().nonnegative(),
        estimatedCostMinor: z.number().nonnegative().optional(),
        runtimeMs: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string()),
    errors: z.array(providerExecutionErrorSchema),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.usage.recordsReturned !== response.records.length) {
      context.addIssue({
        code: "custom",
        path: ["usage", "recordsReturned"],
        message: "Provider usage must report the persisted raw record count.",
      });
    }
    const sourceKeys = response.records.map((record) => record.sourceRecordKey);
    if (new Set(sourceKeys).size !== sourceKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["records"],
        message: "Provider source-record keys must be unique within an execution.",
      });
    }
    const recordKeys = new Set(sourceKeys);
    for (const candidate of response.normalizedCandidates) {
      if (!recordKeys.has(candidate.sourceRecordKey)) {
        context.addIssue({
          code: "custom",
          path: ["normalizedCandidates"],
          message: "A normalized candidate must reference a provider record key.",
        });
      }
    }
  });

export type DiscoveryProviderCapabilities = z.infer<
  typeof discoveryProviderCapabilitiesSchema
>;
export type ProviderDiscoveryRequest = z.infer<typeof providerDiscoveryRequestSchema>;
export type ProviderDiscoveryEstimate = z.infer<typeof providerDiscoveryEstimateSchema>;
export type ProviderDiscoveryResponse = z.infer<typeof providerDiscoveryResponseSchema>;
export type ProviderSourceRecordInput = z.infer<typeof providerSourceRecordInputSchema>;
export type NormalizedProviderCandidateInput = z.infer<
  typeof normalizedProviderCandidateInputSchema
>;
