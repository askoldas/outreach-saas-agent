import assert from "node:assert/strict";
import test from "node:test";
import type { WebDiscoveryQuery } from "@/lib/discovery-v2";
import {
  reconstructSettledProviderExecution,
  summarizePersistedProviderCoverage,
} from "./provider-coverage.ts";

test("persisted provider rows reconstruct query yields and unique identity hints", () => {
  const firstFingerprint = "a".repeat(64);
  const secondFingerprint = "b".repeat(64);
  const coverage = summarizePersistedProviderCoverage({
    sources: [
      source("source-1", firstFingerprint, "web_search", "normalized"),
      source("source-2", firstFingerprint, "web_search", "normalized"),
      source("source-3", secondFingerprint, "industry_directory", "failed_normalization"),
    ],
    candidates: [
      candidate("source-1", "Acme", null, "www.acme.example"),
      candidate("source-2", "Acme duplicate", null, "acme.example"),
      candidate("source-3", "Beta GmbH", "beta gmbh", null),
    ],
  });

  assert.deepEqual(coverage.queryResultCounts, {
    [firstFingerprint]: 2,
    [secondFingerprint]: 1,
  });
  assert.deepEqual(coverage.sourceTypes, ["industry_directory", "web_search"]);
  assert.deepEqual(coverage.candidateIdentityHints, [
    "domain:acme.example",
    "name:beta gmbh",
  ]);
  assert.equal(coverage.invalidRecordCount, 1);
  assert.equal(coverage.uniqueCandidateHintCount, 2);
});

test("identity hints can be deduplicated across provider executions", () => {
  const first = summarizePersistedProviderCoverage({
    sources: [],
    candidates: [
      candidate("source-1", "Acme", null, "WWW.ACME.EXAMPLE"),
      candidate("source-2", "INDIGO", "INDIGO", null),
    ],
  });
  const second = summarizePersistedProviderCoverage({
    sources: [],
    candidates: [
      candidate("source-3", "Acme duplicate", null, "acme.example"),
      candidate("source-4", "INDIGO duplicate", "indigo", null),
    ],
  });

  assert.deepEqual(
    [...new Set([...first.candidateIdentityHints, ...second.candidateIdentityHints])],
    ["domain:acme.example", "name:indigo"],
  );
});

test("settled query audit and coverage facts use persisted evidence on replay", () => {
  const queries = [
    query("a", 1, "archetype", "English"),
    query("b", 2, "local_language", "Lithuanian"),
    query("c", 3, "directory", "English"),
  ];
  const result = reconstructSettledProviderExecution({
    queries,
    execution: {
      coverage: {
        candidateIdentityHints: ["domain:acme.example", "name:beta gmbh"],
        invalidRecordCount: 0,
        queryResultCounts: {
          [queries[0]!.fingerprint]: 3,
        },
        sourceTypes: ["web_search"],
        uniqueCandidateHintCount: 2,
      },
      errors: [
        {
          code: "rate_limit",
          message: "Rate limited.",
          retryable: true,
          recordReference: queries[1]!.fingerprint,
        },
      ],
      exhausted: true,
      normalizedCandidateCount: 2,
      providerRecordCount: 3,
      usage: {
        calls: 2,
        recordsReturned: 3,
        runtimeMs: 50,
      },
    },
  });

  assert.deepEqual(
    result.queryAuditRecords.map(({ status, resultCount }) => ({
      status,
      resultCount,
    })),
    [
      { status: "completed", resultCount: 3 },
      { status: "failed", resultCount: 0 },
      { status: "skipped_budget", resultCount: 0 },
    ],
  );
  assert.deepEqual(result.coverageFacts, {
    candidateIdentityHints: ["domain:acme.example", "name:beta gmbh"],
    invalidRecordCount: 0,
    languagesAttempted: ["English", "Lithuanian"],
    normalizedCandidates: 2,
    providerCalls: 2,
    providerExhausted: true,
    providerFailureCount: 1,
    queriesExecuted: 2,
    queryFamiliesAttempted: ["archetype", "local_language"],
    rawRecords: 3,
    sourceTypesAttempted: ["web_search"],
    uniqueCandidateHints: 2,
  });
});

test("unreferenced errors do not fabricate a failed query attribution", () => {
  const queries = [
    query("a", 1, "archetype", "English"),
    query("b", 2, "directory", "English"),
  ];
  const result = reconstructSettledProviderExecution({
    queries,
    execution: {
      coverage: {
        candidateIdentityHints: [],
        invalidRecordCount: 0,
        queryResultCounts: {
          [queries[1]!.fingerprint]: 1,
        },
        sourceTypes: ["industry_directory"],
        uniqueCandidateHintCount: 0,
      },
      errors: [
        {
          code: "timeout",
          message: "Timed out.",
          retryable: true,
        },
      ],
      exhausted: true,
      normalizedCandidateCount: 0,
      providerRecordCount: 1,
      usage: { calls: 2 },
    },
  });

  assert.equal(result.queryAuditRecords[0]?.status, "completed");
  assert.equal(result.queryAuditRecords[1]?.status, "completed");
  assert.equal(result.coverageFacts.providerFailureCount, 1);
});

function source(
  id: string,
  fingerprint: string,
  sourceType: string,
  ingestionStatus: string,
) {
  return {
    id,
    ingestion_status: ingestionStatus,
    query_or_filter_fingerprint: fingerprint,
    source_type: sourceType,
  };
}

function candidate(
  sourceId: string,
  name: string,
  normalizedName: string | null,
  domain: string | null,
) {
  return {
    canonical_domain_hint: domain,
    name,
    normalized_name: normalizedName,
    provider_source_record_id: sourceId,
  };
}

function query(
  seed: string,
  priority: number,
  family: WebDiscoveryQuery["family"],
  language: string,
): WebDiscoveryQuery {
  const fingerprint = seed.repeat(64);
  return {
    id: fingerprint.slice(0, 24),
    campaignId: "campaign-1",
    discoverySegmentId: "segment-1",
    query: `${seed} query`,
    normalizedQuery: `${seed} query`,
    fingerprint,
    family,
    language,
    country: "LT",
    purpose: `Exercise ${family}.`,
    priority,
    status: "planned",
  };
}
