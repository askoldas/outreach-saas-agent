import type { WebDiscoveryQuery } from "@/lib/discovery-v2";
import type { Json } from "@/types/database.types";

export type PersistedProviderSourceFact = {
  id: string;
  ingestion_status: string;
  query_or_filter_fingerprint: string;
  source_type: string;
};

export type PersistedProviderCandidateFact = {
  canonical_domain_hint: string | null;
  name: string;
  normalized_name: string | null;
  provider_source_record_id: string;
};

export type PersistedProviderCoverageSummary = {
  candidateIdentityHints: string[];
  invalidRecordCount: number;
  queryResultCounts: Record<string, number>;
  sourceTypes: string[];
  uniqueCandidateHintCount: number;
};

export type SettledDiscoveryQueryAuditRecord = Omit<WebDiscoveryQuery, "status"> & {
  resultCount: number;
  status: "completed" | "failed" | "skipped_budget";
};

export type ProviderExecutionCoverageFacts = {
  candidateIdentityHints: string[];
  invalidRecordCount: number;
  languagesAttempted: string[];
  normalizedCandidates: number;
  providerCalls: number;
  providerExhausted: boolean;
  providerFailureCount: number;
  queriesExecuted: number;
  queryFamiliesAttempted: string[];
  rawRecords: number;
  sourceTypesAttempted: string[];
  uniqueCandidateHints: number;
};

export function summarizePersistedProviderCoverage(input: {
  sources: PersistedProviderSourceFact[];
  candidates: PersistedProviderCandidateFact[];
}): PersistedProviderCoverageSummary {
  const queryResultCounts: Record<string, number> = {};
  for (const source of input.sources) {
    queryResultCounts[source.query_or_filter_fingerprint] =
      (queryResultCounts[source.query_or_filter_fingerprint] ?? 0) + 1;
  }
  const candidateIdentityHints = sortedUnique(
    input.candidates
      .map(candidateIdentityHint)
      .filter((value): value is string => Boolean(value)),
  );
  return {
    candidateIdentityHints,
    invalidRecordCount: input.sources.filter(
      ({ ingestion_status }) => ingestion_status === "failed_normalization",
    ).length,
    queryResultCounts: orderedRecord(queryResultCounts),
    sourceTypes: sortedUnique(input.sources.map(({ source_type }) => source_type)),
    uniqueCandidateHintCount: candidateIdentityHints.length,
  };
}

export function reconstructSettledProviderExecution(input: {
  queries: WebDiscoveryQuery[];
  execution: {
    coverage: PersistedProviderCoverageSummary;
    errors: Json;
    exhausted: boolean;
    normalizedCandidateCount: number;
    providerRecordCount: number;
    usage: Json;
  };
}): {
  coverageFacts: ProviderExecutionCoverageFacts;
  queryAuditRecords: SettledDiscoveryQueryAuditRecord[];
} {
  const orderedQueries = [...input.queries].sort(
    (left, right) =>
      left.priority - right.priority || compareText(left.fingerprint, right.fingerprint),
  );
  const providerCalls = nonnegativeInteger(jsonNumber(input.execution.usage, "calls"));
  const attemptedQueries = orderedQueries.slice(
    0,
    Math.min(providerCalls, orderedQueries.length),
  );
  const failedFingerprints = matchFailuresToQueries(
    attemptedQueries,
    input.execution.errors,
  );
  const attemptedFingerprints = new Set(
    attemptedQueries.map(({ fingerprint }) => fingerprint),
  );
  const queryAuditRecords = orderedQueries.map((query) => ({
    ...query,
    resultCount: input.execution.coverage.queryResultCounts[query.fingerprint] ?? 0,
    status: attemptedFingerprints.has(query.fingerprint)
      ? failedFingerprints.has(query.fingerprint)
        ? ("failed" as const)
        : ("completed" as const)
      : ("skipped_budget" as const),
  }));
  return {
    queryAuditRecords,
    coverageFacts: {
      candidateIdentityHints: [...input.execution.coverage.candidateIdentityHints],
      invalidRecordCount: input.execution.coverage.invalidRecordCount,
      languagesAttempted: sortedUnique(attemptedQueries.map(({ language }) => language)),
      normalizedCandidates: nonnegativeInteger(input.execution.normalizedCandidateCount),
      providerCalls,
      providerExhausted: input.execution.exhausted,
      providerFailureCount: jsonArray(input.execution.errors).length,
      queriesExecuted: attemptedQueries.length,
      queryFamiliesAttempted: sortedUnique(attemptedQueries.map(({ family }) => family)),
      rawRecords: nonnegativeInteger(input.execution.providerRecordCount),
      sourceTypesAttempted: [...input.execution.coverage.sourceTypes],
      uniqueCandidateHints: input.execution.coverage.uniqueCandidateHintCount,
    },
  };
}

function matchFailuresToQueries(queries: WebDiscoveryQuery[], errors: Json) {
  const queryByReference = new Map<string, WebDiscoveryQuery>();
  for (const query of queries) {
    queryByReference.set(query.id, query);
    queryByReference.set(query.fingerprint, query);
  }
  const failed = new Set<string>();
  for (const error of jsonArray(errors)) {
    const reference =
      error && typeof error === "object" && !Array.isArray(error)
        ? error.recordReference
        : undefined;
    const query =
      typeof reference === "string" ? queryByReference.get(reference) : undefined;
    if (query) failed.add(query.fingerprint);
  }
  return failed;
}

function candidateIdentityHint(candidate: PersistedProviderCandidateFact) {
  const domain = candidate.canonical_domain_hint?.trim().toLowerCase();
  if (domain) return `domain:${domain.replace(/^www\./, "")}`;
  const name = (candidate.normalized_name ?? candidate.name)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return name ? `name:${name}` : undefined;
}

function jsonArray(value: Json) {
  return Array.isArray(value) ? value : [];
}

function jsonNumber(value: Json, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Number(value[key]);
}

function nonnegativeInteger(value: number) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function orderedRecord(value: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareText(left, right)),
  );
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
