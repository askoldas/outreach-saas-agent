export type DiscoveryBenchmarkCompany = {
  category: string;
  countryCode: string;
  domain: string;
  name: string;
  relevanceNotes?: string;
};

export type DiscoveryBenchmarkFixture = {
  campaignBrief: {
    discoveryLanguages: string[];
    offering: string;
    targetCountries: string[];
    targetCompanyCategories: string[];
  };
  expectedCompanies: DiscoveryBenchmarkCompany[];
  excludedCompanies: DiscoveryBenchmarkCompany[];
  id: string;
  name: string;
};

export type DiscoveryBenchmarkTrace = {
  accepted: boolean;
  category?: string;
  classification: "eligible" | "ineligible" | "possible";
  countryCode?: string;
  deduplicated: boolean;
  discoveryLanguage: string;
  discoveryPath: string;
  domain: string;
  provider: string;
  qualificationScore?: number;
  query: string;
  rejectionReason?: string;
};

export type DiscoveryBenchmarkMetrics = {
  acceptedCompanyPrecision: number;
  costPerAcceptedCompany: number | null;
  coverage: {
    category: Record<string, number>;
    country: Record<string, number>;
    discoveryLanguage: Record<string, number>;
    sourcePath: Record<string, number>;
  };
  deduplicatedCandidateCount: number;
  duplicateRate: number;
  expectedCompanyRecall: number;
  falseNegativeCount: number;
  falsePositiveCount: number;
  rawCandidateCount: number;
  searchRequestsPerAcceptedCompany: number | null;
};

export function evaluateDiscoveryBenchmark(input: {
  fixture: DiscoveryBenchmarkFixture;
  searchCost: number;
  traces: DiscoveryBenchmarkTrace[];
}): DiscoveryBenchmarkMetrics {
  const expected = new Set(
    input.fixture.expectedCompanies.map((item) => domain(item.domain)),
  );
  const accepted = new Set(
    input.traces.filter((item) => item.accepted).map((item) => domain(item.domain)),
  );
  const foundExpected = intersection(expected, accepted).size;
  const trueAccepted = foundExpected;
  const falsePositiveCount = accepted.size - trueAccepted;
  const deduplicatedCandidateCount = input.traces.filter(
    (item) => !item.deduplicated,
  ).length;
  const acceptedCount = accepted.size;
  const searchRequestCount = new Set(
    input.traces.map(
      (item) => `${item.provider}\u0000${item.discoveryLanguage}\u0000${item.query}`,
    ),
  ).size;
  const acceptedTraces = uniqueAcceptedTraces(input.traces);

  return {
    acceptedCompanyPrecision: ratio(trueAccepted, trueAccepted + falsePositiveCount),
    costPerAcceptedCompany: acceptedCount > 0 ? input.searchCost / acceptedCount : null,
    coverage: {
      category: coverage(
        input.fixture.campaignBrief.targetCompanyCategories,
        acceptedTraces.map((item) => item.category),
      ),
      country: coverage(
        input.fixture.campaignBrief.targetCountries,
        acceptedTraces.map((item) => item.countryCode),
      ),
      discoveryLanguage: coverage(
        input.fixture.campaignBrief.discoveryLanguages,
        acceptedTraces.map((item) => item.discoveryLanguage),
      ),
      sourcePath: coverage(
        unique(input.traces.map((item) => item.discoveryPath)),
        acceptedTraces.map((item) => item.discoveryPath),
      ),
    },
    deduplicatedCandidateCount,
    duplicateRate: ratio(
      input.traces.length - deduplicatedCandidateCount,
      input.traces.length,
    ),
    expectedCompanyRecall: ratio(foundExpected, expected.size),
    falseNegativeCount: expected.size - foundExpected,
    falsePositiveCount,
    rawCandidateCount: input.traces.length,
    searchRequestsPerAcceptedCompany:
      acceptedCount > 0 ? searchRequestCount / acceptedCount : null,
  };
}

export function explainExpectedCompanyOutcome(
  expectedDomain: string,
  traces: DiscoveryBenchmarkTrace[],
) {
  const matches = traces.filter((item) => domain(item.domain) === domain(expectedDomain));
  if (!matches.length) return "not_discovered" as const;
  if (matches.every((item) => item.deduplicated)) {
    return "deduplicated" as const;
  }
  if (matches.every((item) => item.classification === "ineligible")) {
    return "rejected_during_classification" as const;
  }
  if (!matches.some((item) => item.accepted)) {
    return "rejected_during_qualification" as const;
  }
  return "accepted" as const;
}

function uniqueAcceptedTraces(traces: DiscoveryBenchmarkTrace[]) {
  const seen = new Set<string>();
  return traces.filter((item) => {
    const key = domain(item.domain);
    if (!item.accepted || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coverage(expectedKeys: string[], observedKeys: Array<string | undefined>) {
  const counts = new Map<string, number>();
  for (const key of observedKeys.filter((value): value is string => Boolean(value))) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    unique([...expectedKeys, ...counts.keys()]).map((key) => [key, counts.get(key) ?? 0]),
  );
}

function domain(value: string) {
  const normalized = value.trim().toLowerCase();
  try {
    return new URL(
      normalized.includes("://") ? normalized : `https://${normalized}`,
    ).hostname.replace(/^www\./, "");
  } catch {
    return normalized.replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

function intersection(left: Set<string>, right: Set<string>) {
  return new Set([...left].filter((item) => right.has(item)));
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function unique(values: Iterable<string>) {
  return [...new Set(values)];
}
