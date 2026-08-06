import { z } from "zod";

export const discoveryProgressCountersSchema = z
  .object({
    providerRecordsRetrieved: z.number().int().nonnegative(),
    normalizedProviderCandidates: z.number().int().nonnegative(),
    uniqueCandidateGroups: z.number().int().nonnegative(),
    canonicalOrganizations: z.number().int().nonnegative(),
    candidatesPrefiltered: z.number().int().nonnegative(),
    candidatesResearched: z.number().int().nonnegative(),
    candidatesEvaluated: z.number().int().nonnegative(),
    eligibleCandidates: z.number().int().nonnegative(),
    recommendedCandidates: z.number().int().nonnegative(),
    conditionalCandidates: z.number().int().nonnegative(),
    researchNeededCandidates: z.number().int().nonnegative(),
    rejectedCandidates: z.number().int().nonnegative(),
    excludedCandidates: z.number().int().nonnegative(),
    invalidEntities: z.number().int().nonnegative(),
    duplicatesOrMergedEntities: z.number().int().nonnegative(),
  })
  .strict();

export type DiscoveryProgressCounters = z.infer<typeof discoveryProgressCountersSchema>;

export function emptyDiscoveryProgressCounters(): DiscoveryProgressCounters {
  return {
    providerRecordsRetrieved: 0,
    normalizedProviderCandidates: 0,
    uniqueCandidateGroups: 0,
    canonicalOrganizations: 0,
    candidatesPrefiltered: 0,
    candidatesResearched: 0,
    candidatesEvaluated: 0,
    eligibleCandidates: 0,
    recommendedCandidates: 0,
    conditionalCandidates: 0,
    researchNeededCandidates: 0,
    rejectedCandidates: 0,
    excludedCandidates: 0,
    invalidEntities: 0,
    duplicatesOrMergedEntities: 0,
  };
}
