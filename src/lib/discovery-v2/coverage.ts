import { z } from "zod";

export const discoveryCoverageMetricsSchema = z
  .object({
    campaignId: z.string().min(1),
    discoverySegmentId: z.string().min(1),
    archetypeId: z.string().min(1),
    geographyKey: z.string().min(1),
    providerCalls: z.number().int().nonnegative(),
    queriesExecuted: z.number().int().nonnegative(),
    queryFamiliesAttempted: z.array(z.string()),
    expectedQueryFamilies: z.array(z.string()),
    rawRecords: z.number().int().nonnegative(),
    normalizedCandidates: z.number().int().nonnegative(),
    uniqueCandidateHints: z.number().int().nonnegative(),
    invalidRecordCount: z.number().int().nonnegative(),
    plausibleCandidateCount: z.number().int().nonnegative().optional(),
    qualifiedCandidateCount: z.number().int().nonnegative().optional(),
    sourceTypesAttempted: z.array(z.string()),
    languagesAttempted: z.array(z.string()),
    expectedLocalLanguages: z.array(z.string()),
    targetUniqueCandidates: z.number().int().positive().optional(),
    providerFailureCount: z.number().int().nonnegative(),
    providerExhausted: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const discoveryCoverageCellSchema = discoveryCoverageMetricsSchema
  .omit({
    queryFamiliesAttempted: true,
    expectedQueryFamilies: true,
    sourceTypesAttempted: true,
    expectedLocalLanguages: true,
    targetUniqueCandidates: true,
    providerFailureCount: true,
    providerExhausted: true,
  })
  .extend({
    duplicateRate: z.number().min(0).max(1),
    invalidRecordRate: z.number().min(0).max(1),
    uniqueYieldPerCall: z.number().nonnegative(),
    plausibleYieldPerCall: z.number().nonnegative().optional(),
    sourceDiversityCount: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    status: z.enum([
      "not_started",
      "insufficient",
      "developing",
      "sufficient",
      "exhausted",
      "blocked",
    ]),
    reasons: z.array(z.string()),
  })
  .strict();

export type DiscoveryCoverageMetrics = z.infer<typeof discoveryCoverageMetricsSchema>;
export type DiscoveryCoverageCell = z.infer<typeof discoveryCoverageCellSchema>;

export function calculateDiscoveryCoverage(
  rawMetrics: DiscoveryCoverageMetrics,
): DiscoveryCoverageCell {
  const metrics = discoveryCoverageMetricsSchema.parse(rawMetrics);
  const duplicateCount = Math.max(
    0,
    metrics.normalizedCandidates - metrics.uniqueCandidateHints,
  );
  const duplicateRate = ratio(duplicateCount, metrics.normalizedCandidates);
  const invalidRecordRate = ratio(metrics.invalidRecordCount, metrics.rawRecords);
  const uniqueYieldPerCall = ratio(metrics.uniqueCandidateHints, metrics.providerCalls);
  const plausibleYieldPerCall =
    metrics.plausibleCandidateCount === undefined
      ? undefined
      : ratio(metrics.plausibleCandidateCount, metrics.providerCalls);
  const queryCoverage = setCoverage(
    metrics.queryFamiliesAttempted,
    metrics.expectedQueryFamilies,
  );
  const languageCoverage =
    metrics.expectedLocalLanguages.length === 0
      ? 1
      : setCoverage(metrics.languagesAttempted, metrics.expectedLocalLanguages);
  const sourceDiversityCount = new Set(metrics.sourceTypesAttempted).size;
  const sourceCoverage = Math.min(sourceDiversityCount / 2, 1);
  const identityQuality = ratio(
    metrics.normalizedCandidates - metrics.invalidRecordCount,
    metrics.normalizedCandidates,
  );
  const yieldSignal = Math.min(uniqueYieldPerCall / 2, 1);
  const confidence = round(
    queryCoverage * 0.25 +
      languageCoverage * 0.2 +
      sourceCoverage * 0.2 +
      identityQuality * 0.2 +
      yieldSignal * 0.15,
  );
  const targetReached =
    metrics.targetUniqueCandidates !== undefined &&
    metrics.uniqueCandidateHints >= metrics.targetUniqueCandidates;
  const allQueriesAttempted = queryCoverage === 1;
  const allLanguagesAttempted = languageCoverage === 1;
  let status: DiscoveryCoverageCell["status"];
  const reasons: string[] = [];
  if (metrics.providerCalls === 0 && metrics.providerFailureCount > 0) {
    status = "blocked";
    reasons.push("All attempted provider work failed before producing coverage.");
  } else if (metrics.providerCalls === 0) {
    status = "not_started";
    reasons.push("No provider calls have completed.");
  } else if (targetReached && confidence >= 0.65) {
    status = "sufficient";
    reasons.push("The segment target and evidence-based coverage threshold are met.");
  } else if (
    metrics.providerExhausted &&
    allQueriesAttempted &&
    allLanguagesAttempted &&
    uniqueYieldPerCall < 0.5
  ) {
    status = "exhausted";
    reasons.push(
      "Available provider paths are exhausted with low marginal unique yield.",
    );
  } else if (confidence >= 0.4) {
    status = "developing";
    reasons.push("Coverage is developing but has not met the segment target.");
  } else {
    status = "insufficient";
    reasons.push("Source, language, query-family, or identity coverage remains weak.");
  }
  return discoveryCoverageCellSchema.parse({
    campaignId: metrics.campaignId,
    discoverySegmentId: metrics.discoverySegmentId,
    archetypeId: metrics.archetypeId,
    geographyKey: metrics.geographyKey,
    providerCalls: metrics.providerCalls,
    queriesExecuted: metrics.queriesExecuted,
    rawRecords: metrics.rawRecords,
    normalizedCandidates: metrics.normalizedCandidates,
    uniqueCandidateHints: metrics.uniqueCandidateHints,
    invalidRecordCount: metrics.invalidRecordCount,
    ...(metrics.plausibleCandidateCount === undefined
      ? {}
      : { plausibleCandidateCount: metrics.plausibleCandidateCount }),
    ...(metrics.qualifiedCandidateCount === undefined
      ? {}
      : { qualifiedCandidateCount: metrics.qualifiedCandidateCount }),
    duplicateRate,
    invalidRecordRate,
    uniqueYieldPerCall,
    ...(plausibleYieldPerCall === undefined ? {} : { plausibleYieldPerCall }),
    sourceDiversityCount,
    languagesAttempted: [...new Set(metrics.languagesAttempted)].sort(),
    confidence,
    status,
    reasons,
    updatedAt: metrics.updatedAt,
  });
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function setCoverage(attempted: string[], expected: string[]) {
  if (!expected.length) return 1;
  const values = new Set(attempted);
  return expected.filter((value) => values.has(value)).length / expected.length;
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
